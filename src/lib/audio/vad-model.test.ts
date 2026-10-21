/**
 * The Silero classifier's suite, against the pinned model itself.
 *
 *   node --test src/lib/audio/vad-model.test.ts
 *
 * ONNX Runtime's web build runs in Node, so this is the real file and the real tensor
 * plumbing — the same code the worker calls, with the runtime injected. What it pins is
 * the contract the recorder relies on: a frame gets a probability, silence does not read
 * as speech, the state advances between frames, and a reset returns to zeros.
 *
 * It does not pin detection accuracy: the noisy-room replay that justifies the threshold
 * is recorded in the change's design.md, and it uses captured audio this suite does not
 * carry.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as ort from "onnxruntime-web";

import {
  createSileroClassifier,
  VAD_STATE_LENGTH,
  type OrtRuntimeLike,
} from "./vad-model.ts";

/** The tracked model, relative to this file: src/lib/audio → repository root. */
const MODEL_BYTES = new Uint8Array(
  readFileSync(new URL("../../../public/vad/silero_vad.onnx", import.meta.url))
);

function silence(): Float32Array {
  return new Float32Array(512);
}

function noise(amplitude = 0.1): Float32Array {
  const frame = new Float32Array(512);
  for (let index = 0; index < frame.length; index++) {
    frame[index] = (Math.random() * 2 - 1) * amplitude;
  }
  return frame;
}

describe("the pinned Silero model", () => {
  it("answers a probability per frame and carries state between frames", async () => {
    const classifier = await createSileroClassifier(
      ort as unknown as OrtRuntimeLike,
      MODEL_BYTES
    );

    assert.equal(classifier.state().length, VAD_STATE_LENGTH);
    assert.ok(
      classifier.state().every((value) => value === 0),
      "a new recording starts from a zero state"
    );

    const quiet = await classifier.classify(silence());
    assert.ok(quiet >= 0 && quiet <= 1, `a probability must be in [0, 1], got ${quiet}`);
    assert.ok(quiet < 0.5, `silence must not read as speech, got ${quiet}`);

    await classifier.classify(noise());
    assert.ok(
      classifier.state().some((value) => value !== 0),
      "the model's state must advance after a frame"
    );

    classifier.reset();
    assert.ok(
      classifier.state().every((value) => value === 0),
      "a reset must return the model to the state a new recording starts from"
    );
  });
});
