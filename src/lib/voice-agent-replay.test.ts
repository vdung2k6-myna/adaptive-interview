/**
 * The replay-retention rule. Run with Node's own runner:
 *
 *   node --test src/lib/voice-agent-replay.test.ts
 *
 * The helper takes a map, so nothing here needs a browser or an audio context.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { collectReplayAudio } from "./voice-agent-replay.ts";

describe("collectReplayAudio", () => {
  it("orders the segments by their index, not by arrival", () => {
    const segments = new Map<number, string>([
      [2, "third"],
      [0, "first"],
      [1, "second"],
    ]);

    assert.deepEqual(collectReplayAudio(segments), ["first", "second", "third"]);
  });

  it("keeps one entry per index when a turn repeats it", () => {
    const segments = new Map<number, string>();
    segments.set(0, "first");
    segments.set(0, "first-again");

    assert.deepEqual(
      collectReplayAudio(segments),
      ["first-again"],
      "a repeated index is the same segment, and the later delivery is what played"
    );
  });

  it("has nothing to replay for a turn that delivered no audio", () => {
    assert.deepEqual(collectReplayAudio(new Map()), []);
  });
});
