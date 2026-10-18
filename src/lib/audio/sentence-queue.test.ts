/**
 * The queue's failure suite. Run with Node's own runner:
 *
 *   node --test src/lib/audio/sentence-queue.test.ts
 *
 * The queue takes its AudioContext and its fetch as constructor parameters, so both
 * are stood in for here: a segment that cannot be played has to be observable without
 * a browser, without a server, and without touching a global.
 *
 * What this suite pins is the rule the recovery is built on top of rather than
 * around — a failed segment is skipped and the sequence advances, so the failure
 * costs one sentence instead of the rest of the answer. Recovery replaces the
 * answer; it does not replace this.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SentenceAudioQueue, type QueueFetch } from "./sentence-queue.ts";

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
 * 404 that a swept segment file answers with — and, since the mount that serves them
 * now wears the API's credential, stand in for an *authenticated* caller: the queue
 * is handed a fetch, so what it sends is whatever this function does. */
function fakeFetch(missing: Set<string> = new Set()) {
  return (async (input: string) => {
    if (missing.has(String(input))) {
      return { ok: false, status: 404 } as Response;
    }
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Response;
  }) as QueueFetch;
}

interface Recorded {
  started: number[];
  errored: number[];
  finished: () => number;
  done: Promise<void>;
}

/** Drive a three-segment answer and record what the queue reported. The fetch is
 * **required** rather than defaulted, so that each test says which caller it is standing
 * in for — the queue's own option is required for the same reason. */
function playThree(options: { fetchAudio: QueueFetch; decodeFails?: boolean }): Recorded {
  const started: number[] = [];
  const errored: number[] = [];
  let finished = 0;
  let resolveDone: () => void = () => {};

  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const queue = new SentenceAudioQueue(fakeAudioContext(options), {
    fetch: options.fetchAudio,
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
    const r = playThree({ fetchAudio: fakeFetch(new Set(["/audio/two.wav"])) });

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
    const r = playThree({ fetchAudio: fakeFetch(), decodeFails: true });

    await r.done;

    assert.deepEqual(r.errored, [0, 1, 2], "every undecodable segment is reported");
    assert.equal(r.finished(), 1, "a turn with nothing playable still ends rather than hanging");
  });
});

describe("cancelling one item", () => {
  it("removes a queued track without silencing the reply", async () => {
    // The person started a track while the reply was still being spoken: the
    // track is queued behind the reply, and stopping it must leave the reply
    // playing. This is the behaviour task 3.3 asks for and design D4 owes.
    const started: number[] = [];
    let finished = 0;
    let resolveDone: () => void = () => {};
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
    const queue = new SentenceAudioQueue(fakeAudioContext(), {
      fetch: fakeFetch(),
      onStart: (index) => started.push(index),
      onFinished: () => {
        finished += 1;
        resolveDone();
      },
    });

    queue.enqueue(0, "/audio/reply.wav");
    queue.enqueue(1_000_000, "/audio/music/a-flac.flac");
    queue.cancel(1_000_000);

    assert.equal(queue.getCurrentIndex(), 0, "the reply is still the item being played");
    assert.equal(queue.getIsPlaying(), true, "the reply was not stopped");
    assert.equal(queue.getQueueLength(), 0, "the track is gone from the queue");

    await done;

    assert.deepEqual(started, [0], "only the reply started");
    assert.equal(finished, 1, "the reply still reaches its end");
  });

  it("stops a track that has already started and finishes the queue", async () => {
    // The track is the current item, not a queued one. Cancelling it must stop
    // it and let the queue finish, rather than leaving a playNext awaiting its
    // fetch to start the cancelled item afterwards.
    let finished = 0;
    let resolveDone: () => void = () => {};
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
    const queue = new SentenceAudioQueue(fakeAudioContext(), {
      fetch: fakeFetch(),
      onFinished: () => {
        finished += 1;
        resolveDone();
      },
    });

    queue.enqueue(1_000_000, "/audio/music/a-flac.flac");
    queue.cancel(1_000_000);

    assert.equal(queue.getIsPlaying(), false, "nothing is playing");
    assert.equal(queue.getCurrentIndex(), -1, "the item that was current is gone");

    await done;

    assert.equal(finished, 1, "the queue finishes rather than hanging");
  });
});
