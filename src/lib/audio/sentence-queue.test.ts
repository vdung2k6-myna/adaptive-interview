/**
 * The queue's failure suite. Run with Node's own runner:
 *
 *   node --test src/lib/audio/sentence-queue.test.ts
 *
 * The queue takes its AudioContext as a constructor parameter, and the audio
 * fetch through the global one, so both are stood in for here: a segment that
 * cannot be played has to be observable without a browser and without a server.
 *
 * What this suite pins is the rule the recovery is built on top of rather than
 * around — a failed segment is skipped and the sequence advances, so the failure
 * costs one sentence instead of the rest of the answer. Recovery replaces the
 * answer; it does not replace this.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { SentenceAudioQueue } from "./sentence-queue.ts";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

/** A buffer source that ends as soon as it starts, so the queue advances without
 * a clock. How long a segment plays is not what this suite is about. */
class FakeSource {
  buffer: unknown = null;
  playbackRate = { value: 1 };
  onended: (() => void) | null = null;
  connect() {}
  stop() {}
  start() {
    setImmediate(() => this.onended?.());
  }
}

/**
 * The parts of an AudioContext the queue touches. `state: "running"` so nothing
 * waits on a resume that a user gesture would normally have given, and a
 * decodable duration of 1s so a buffer counts as playable unless a test says
 * otherwise.
 */
function fakeAudioContext(options: { decodeFails?: boolean } = {}) {
  return {
    state: "running",
    destination: {},
    resume: async () => {},
    decodeAudioData: async () => {
      if (options.decodeFails) throw new Error("not audio");
      return { duration: 1 };
    },
    createBufferSource: () => new FakeSource(),
  } as unknown as AudioContext;
}

/** Answer every audio request, except the URLs in `missing`, which answer the
 * 404 that a swept segment file answers with. */
function fakeFetch(missing: Set<string> = new Set()) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (missing.has(String(input))) {
      return { ok: false, status: 404 } as Response;
    }
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Response;
  }) as typeof fetch;
}

interface Recorded {
  started: number[];
  errored: number[];
  finished: () => number;
  done: Promise<void>;
}

/** Drive a three-segment answer and record what the queue reported. */
function playThree(options: { decodeFails?: boolean } = {}): Recorded {
  const started: number[] = [];
  const errored: number[] = [];
  let finished = 0;
  let resolveDone: () => void = () => {};

  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const queue = new SentenceAudioQueue(fakeAudioContext(options), {
    onStart: (index) => started.push(index),
    onError: (index) => errored.push(index),
    onFinished: () => {
      finished += 1;
      resolveDone();
    },
  });

  // No text, deliberately: a sentence ending in punctuation pauses before the
  // next one, and these tests are about the sequence, not its rhythm.
  queue.enqueue(0, "/audio/one.wav");
  queue.enqueue(1, "/audio/two.wav");
  queue.enqueue(2, "/audio/three.wav");

  return { started, errored, finished: () => finished, done };
}

describe("a segment that cannot be played", () => {
  it("is reported at its own index, and does not cost the segments after it", async () => {
    // The failure the whole change exists for: a segment's fetch losing to the
    // server having removed the file. It must cost that one sentence.
    fakeFetch(new Set(["/audio/two.wav"]));
    const r = playThree();

    await r.done;

    assert.deepEqual(r.errored, [1], "the failure is reported at the index it happened at");
    assert.deepEqual(
      r.started,
      [0, 1, 2],
      "every segment gets its turn, so no later segment is held back or renumbered"
    );
    assert.equal(r.finished(), 1, "the answer still reaches its end");
  });

  it("is reported and passed over when no segment can be decoded either", async () => {
    // The other way a segment fails, which reaches the same callback — and which
    // the recovery treats the same way, since from the candidate's side a segment
    // that did not play is a segment that did not play.
    fakeFetch();
    const r = playThree({ decodeFails: true });

    await r.done;

    assert.deepEqual(r.errored, [0, 1, 2], "every undecodable segment is reported");
    assert.equal(r.finished(), 1, "a turn with nothing playable still ends rather than hanging");
  });
});
