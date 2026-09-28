/**
 * The recovery suite. Run with Node's own runner:
 *
 *   node --test src/lib/audio/turn-audio-recovery.test.ts
 *
 * No vitest, no jest, no dependency — the module imports no values and takes its
 * effects as parameters, so this needs nothing installed. Note the `.ts`
 * extension in the import below: Node resolves it directly, while the page
 * imports the same module through the `@/*` alias, which type stripping would not
 * resolve.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createTurnAudioRecovery,
  type TurnAudioRecovery,
} from "./turn-audio-recovery.ts";

const CANONICAL = "/audio/session-1/abc-interviewer.wav";

interface Recorder {
  recovery: TurnAudioRecovery;
  /** The URLs the turn's canonical recording was played from, in order. */
  played: string[];
  /** How many times the turn was reported as unplayable. */
  unplayable: () => number;
}

function recorder(): Recorder {
  const played: string[] = [];
  let unplayable = 0;

  const recovery = createTurnAudioRecovery({
    playCanonical: (url) => played.push(url),
    onUnplayable: () => {
      unplayable += 1;
    },
  });

  return { recovery, played, unplayable: () => unplayable };
}

describe("a turn whose segments cannot be played", () => {
  it("plays the canonical recording once when every segment failed", async () => {
    // The shape the bug took: each segment is announced, each fetch loses to the
    // server having removed the file, and the answer arrives as silence. The
    // canonical recording is the whole answer, so one play covers all of them.
    const r = recorder();

    r.recovery.segmentFailed();
    r.recovery.segmentFailed();
    r.recovery.segmentFailed();
    r.recovery.canonicalKnown(CANONICAL);

    assert.deepEqual(r.played, [CANONICAL]);
  });

  it("plays it once when a single segment failed mid-answer", async () => {
    // The turn is already partly heard. Replacing it replays the beginning, which
    // is accepted over the gap — but only once, so the answer is not repeated for
    // every segment that follows.
    const r = recorder();

    r.recovery.segmentFailed();
    r.recovery.canonicalKnown(CANONICAL);
    r.recovery.segmentFailed();
    r.recovery.segmentFailed();

    assert.deepEqual(r.played, [CANONICAL], "a replay per failure would repeat the answer");
  });

  it("plays it for a segment that fails after the turn's final event", async () => {
    // The last segment is announced in the same breath as the turn's end, so its
    // fetch can fail after `done` has already been handled. The canonical URL is
    // known by then — and the replacement must still happen, not be waited for.
    const r = recorder();

    r.recovery.canonicalKnown(CANONICAL);
    r.recovery.segmentFailed();

    assert.deepEqual(r.played, [CANONICAL]);
  });

  it("waits for the canonical URL rather than giving up before it arrives", async () => {
    // A failure mid-answer precedes `done`, which is where the URL comes from. If
    // this reported instead of waiting, every mid-answer failure would be called
    // unplayable before it had been answered.
    const r = recorder();

    r.recovery.segmentFailed();

    assert.deepEqual(r.played, []);
    assert.equal(r.unplayable(), 0, "a failure is not yet an unplayable turn");
  });

  it("leaves a turn that was heard in full alone", async () => {
    // No failure means nothing to stand in for, and replaying a fully heard
    // answer would be a regression rather than a recovery.
    const r = recorder();

    r.recovery.canonicalKnown(CANONICAL);

    assert.deepEqual(r.played, []);
    assert.equal(r.unplayable(), 0);
  });
});

describe("a turn that cannot be heard at all", () => {
  it("reports it once when the canonical recording fails too", async () => {
    // Both the segment and the stand-in failed, so the candidate heard none of
    // the answer. Reported once for the turn, not once per failed segment.
    const r = recorder();

    r.recovery.segmentFailed();
    r.recovery.canonicalKnown(CANONICAL);
    r.recovery.canonicalFailed();
    r.recovery.canonicalFailed();

    assert.deepEqual(r.played, [CANONICAL], "the recovery was attempted");
    assert.equal(r.unplayable(), 1, "the turn is reported once, however many failures it took");
  });

  it("reports it when there is no canonical recording to fall back to", async () => {
    // The server produced no canonical for this turn, so a failed segment has
    // nothing behind it. Silence with no stand-in is the case that passes
    // silently if nothing says so.
    const r = recorder();

    r.recovery.segmentFailed();
    r.recovery.canonicalKnown(null);

    assert.deepEqual(r.played, []);
    assert.equal(r.unplayable(), 1);
  });

  it("says nothing about a turn with no failures, whatever the canonical is", async () => {
    // A canonical recording that is missing from a turn that was heard is the
    // server's business, not something to put in front of the candidate.
    const r = recorder();

    r.recovery.canonicalKnown(null);

    assert.deepEqual(r.played, []);
    assert.equal(r.unplayable(), 0, "nothing was heard wrong, so nothing is reported");
  });

  it("does not report a canonical failure that was never attempted", async () => {
    // Only a recovery that was actually played can fail. A stray call must not
    // blame a turn whose audio was asked for and never needed replacing.
    const r = recorder();

    r.recovery.canonicalFailed();

    assert.equal(r.unplayable(), 0);
  });
});
