/**
 * The answer-pacing suite. Run with Node's own runner:
 *
 *   node --test src/lib/audio/answer-pacing.test.ts
 *
 * What this pins is the range "a minute or two" actually is, at its edges. The marks are the whole
 * of the rule, and the way it goes wrong is not a crash: it is a display that keeps working while
 * describing a range nobody chose, by which time no test would notice.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  paceOf,
  EXPECTED_FROM_MS,
  EXPECTED_UNTIL_MS,
  type AnswerPace,
} from "./answer-pacing.ts";

describe("where an answer stands against the length asked for", () => {
  it("answers a length shorter than a minute as short", () => {
    assert.equal(paceOf(0), "short", "nothing spoken yet is not an answer that has run long");
    assert.equal(paceOf(30_000), "short");
    assert.equal(paceOf(EXPECTED_FROM_MS - 1), "short", "the mark itself is not short of it");
  });

  it("answers a minute as the length that was asked for", () => {
    assert.equal(
      paceOf(EXPECTED_FROM_MS),
      "expected",
      "the lower mark opens the range rather than closing the state below it"
    );
    assert.equal(paceOf(90_000), "expected");
    assert.equal(
      paceOf(EXPECTED_UNTIL_MS),
      "expected",
      "and the upper mark is still inside it, two minutes being the 'or two'"
    );
  });

  it("answers past two minutes as long", () => {
    assert.equal(paceOf(EXPECTED_UNTIL_MS + 1), "long");
    assert.equal(paceOf(5 * 60_000), "long");
  });

  it("answers each mark as the state it opens, not the one it ends", () => {
    // Both marks are inclusive upwards, which is the whole reason they are tested at exactly their
    // own values rather than only on either side of them.
    const marks: [number, AnswerPace][] = [
      [EXPECTED_FROM_MS, "expected"],
      [EXPECTED_UNTIL_MS, "expected"],
      [EXPECTED_FROM_MS - 1, "short"],
      [EXPECTED_UNTIL_MS + 1, "long"],
    ];

    assert.deepEqual(
      marks.map(([elapsed]) => paceOf(elapsed)),
      marks.map(([, expected]) => expected)
    );
  });

  it("answers a time it cannot read as no time at all", () => {
    // Never produced by the recorder's own clock, and the costliest mistake available here: telling
    // somebody their answer has run long on the strength of a value that was never about them.
    assert.equal(paceOf(Number.NaN), "short");
    assert.equal(paceOf(Number.POSITIVE_INFINITY), "short");
    assert.equal(paceOf(-1), "short");
  });
});
