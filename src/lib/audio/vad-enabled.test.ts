/**
 * The build switch's suite. Run with Node's own runner:
 *
 *   node --test src/lib/audio/vad-enabled.test.ts
 *
 * The module reads the environment once, at import, so the decision is tested through
 * `vadEnabled` rather than by re-importing with a changed environment.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { vadEnabled } from "./vad-enabled.ts";

describe("the speech-classification build switch", () => {
  it("is on unless the build says the literal false", () => {
    assert.equal(vadEnabled(undefined), true);
    assert.equal(vadEnabled(""), true);
    assert.equal(vadEnabled("true"), true);
    assert.equal(vadEnabled("false"), false);
  });

  it("does not read any other spelling as off", () => {
    // A value that is not the literal is a typo, and a typo must not silently change
    // how a recording decides the person has stopped speaking.
    assert.equal(vadEnabled("FALSE"), true);
    assert.equal(vadEnabled("0"), true);
    assert.equal(vadEnabled("off"), true);
  });
});
