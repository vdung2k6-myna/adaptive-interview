/**
 * The endpointer suite. Run with Node's own runner:
 *
 *   node --test src/lib/audio/recording-endpointer.test.ts
 *
 * What this pins is the decision, not the audio graph: when a recording ends because
 * speech stopped, when it is discarded because nobody spoke, and when it is capped
 * because it was abandoned. Time is samples here for the same reason it is samples in
 * the endpointer — a background tab's throttled timer must not be able to keep a
 * microphone open.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createRecordingEndpointer,
  type EndpointVerdict,
  type RecordingEndpointer,
} from "./recording-endpointer.ts";
import {
  readRecordingLimits,
  RECORDING_LIMITS,
  type RecordingLimits,
} from "./recording-limits.ts";

const RATE = 16_000;

/** Hand the endpointer `ms` of audio at one level, as the recorder does per frame. */
function feed(ep: RecordingEndpointer, rms: number, ms: number): EndpointVerdict {
  return ep.push(rms, Math.round((ms / 1_000) * RATE));
}

/** Feed `ms` in 20 ms frames, returning the first verdict that is not "wait". */
function feedUntilVerdict(
  ep: RecordingEndpointer,
  rms: number,
  ms: number
): { verdict: EndpointVerdict; elapsedMs: number } {
  let verdict: EndpointVerdict = "wait";
  for (let taken = 0; taken < ms; taken += 20) {
    verdict = feed(ep, rms, 20);
    if (verdict !== "wait") return { verdict, elapsedMs: ep.elapsedMs() };
  }
  return { verdict, elapsedMs: ep.elapsedMs() };
}

const LIMITS: RecordingLimits = {
  minSpeechMs: 300,
  silenceMs: 1_000,
  noSpeechMs: 15_000,
  maxMs: 600_000,
};

function endpointer(limits: RecordingLimits = LIMITS): RecordingEndpointer {
  return createRecordingEndpointer({ sampleRate: RATE, limits });
}

describe("the surface limits", () => {
  it("ships defaults that differ between a conversation and an interview", () => {
    assert.deepEqual(RECORDING_LIMITS.voiceAgent, {
      minSpeechMs: 300,
      silenceMs: 1_000,
      noSpeechMs: 15_000,
      maxMs: 2 * 60_000,
    });
    assert.deepEqual(RECORDING_LIMITS.interview, {
      minSpeechMs: 300,
      silenceMs: 3_000,
      noSpeechMs: 15_000,
      maxMs: 10 * 60_000,
    });
  });

  it("takes each surface's silence from its own setting", () => {
    // The case this setting exists for: a deployment that wants the voice agent to
    // wait three seconds for a pause instead of the shipped one.
    const configured = readRecordingLimits({
      voiceAgent: { silenceMs: "3000" },
      interview: {},
    });

    assert.equal(configured.voiceAgent.silenceMs, 3_000);
    assert.equal(configured.interview.silenceMs, RECORDING_LIMITS.interview.silenceMs);
  });

  it("reads every limit from settings", () => {
    const configured = readRecordingLimits({
      minSpeechMs: "400",
      voiceAgent: { silenceMs: "3000", noSpeechMs: "20000", maxMs: "90000" },
      interview: { silenceMs: "4500", noSpeechMs: "20000", maxMs: "900000" },
    });

    assert.deepEqual(configured.voiceAgent, {
      minSpeechMs: 400,
      silenceMs: 3_000,
      noSpeechMs: 20_000,
      maxMs: 90_000,
    });
    assert.deepEqual(configured.interview, {
      minSpeechMs: 400,
      silenceMs: 4_500,
      noSpeechMs: 20_000,
      maxMs: 900_000,
    });
  });

  it("takes the default for a setting that is zero, negative or unreadable", () => {
    const configured = readRecordingLimits({
      minSpeechMs: "not-a-number",
      voiceAgent: { silenceMs: "0", noSpeechMs: "-1", maxMs: "" },
      interview: { silenceMs: "nope", noSpeechMs: "0", maxMs: "-5" },
    });

    assert.deepEqual(configured.voiceAgent, RECORDING_LIMITS.voiceAgent);
    assert.deepEqual(configured.interview, RECORDING_LIMITS.interview);
  });

  it("bounds an abandoned recording well above the expected answer by default", () => {
    // Not "a minute or two": reaching this must mean abandonment, not a long answer.
    assert.ok(RECORDING_LIMITS.interview.maxMs > 5 * 60_000);
  });
});

describe("when speech stops", () => {
  it("ends after the configured silence that follows speech", () => {
    const ep = endpointer();

    assert.equal(feed(ep, 0.1, 400), "wait");
    assert.equal(ep.hasHeardSpeech(), true);
    assert.equal(feed(ep, 0.001, 980), "wait");
    assert.equal(feed(ep, 0.001, 20), "end");
  });

  it("does not end on a pause shorter than the silence interval", () => {
    const ep = endpointer();

    feed(ep, 0.1, 400);
    assert.equal(feed(ep, 0.001, 900), "wait");
    // The person resumes for less than a full speech run; the silence clock restarts.
    assert.equal(feed(ep, 0.1, 100), "wait");
    assert.equal(feed(ep, 0.001, 900), "wait");
    assert.equal(feed(ep, 0.001, 100), "end");
  });

  it("keeps judging silence after speech, with the gate still low", () => {
    const ep = endpointer();

    feed(ep, 0.003, 600); // room, quieter than the minimum gate: learns the floor
    feed(ep, 0.05, 400); // speech, above the gate and never fed to the floor
    assert.ok(ep.gate() < 0.05, "sustained speech raised the gate above the speaker");

    assert.equal(feed(ep, 0.003, 1_000), "end");
  });
});

describe("when nobody speaks", () => {
  it("discards a recording that has heard no speech by the giveup bound", () => {
    const ep = endpointer();
    const result = feedUntilVerdict(ep, 0.001, 16_000);

    assert.equal(result.verdict, "giveup");
    assert.equal(ep.hasHeardSpeech(), false);
    assert.ok(result.elapsedMs >= LIMITS.noSpeechMs);
  });

  it("does not treat a single loud block as speech", () => {
    const ep = endpointer();

    assert.equal(feed(ep, 0.5, 20), "wait");
    const result = feedUntilVerdict(ep, 0.001, 15_000);

    assert.equal(result.verdict, "giveup");
    assert.equal(ep.hasHeardSpeech(), false);
  });

  it("never reports an end for a recording with no speech", () => {
    const ep = endpointer();
    // A long quiet room: silence never begins to count, because speech never did.
    for (let taken = 0; taken < 14_000; taken += 20) {
      assert.equal(feed(ep, 0.001, 20), "wait");
    }
  });
});

describe("the abandonment bound", () => {
  it("caps a recording that never goes quiet, even while speech continues", () => {
    const ep = endpointer({ ...LIMITS, maxMs: 2_000 });
    let verdict: EndpointVerdict = "wait";

    for (let taken = 0; taken < 2_000; taken += 20) {
      verdict = feed(ep, 0.2, 20);
      if (verdict !== "wait") {
        assert.equal(taken + 20, 2_000, "the cap fired before the stated maximum");
        break;
      }
    }

    assert.equal(verdict, "cap");
    assert.equal(ep.verdict(), "cap");
  });

  it("stays capped for any frame that follows the decision", () => {
    const ep = endpointer({ ...LIMITS, maxMs: 1_000 });

    feedUntilVerdict(ep, 0.2, 1_000);
    assert.equal(feed(ep, 0.2, 20), "cap");
  });
});

describe("the clock", () => {
  it("measures the same elapsed time at either sample rate", () => {
    const at16k = createRecordingEndpointer({ sampleRate: 16_000, limits: LIMITS });
    const at48k = createRecordingEndpointer({ sampleRate: 48_000, limits: LIMITS });

    at16k.push(0.001, 16_000);
    at48k.push(0.001, 48_000);

    assert.equal(at16k.elapsedMs(), 1_000);
    assert.equal(at48k.elapsedMs(), 1_000);
  });
});
