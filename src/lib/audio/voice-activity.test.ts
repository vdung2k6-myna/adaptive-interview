/**
 * The voice-activity wrapper's suite. Run with Node's own runner:
 *
 *   node --test src/lib/audio/voice-activity.test.ts
 *
 * The model is injected, so what is pinned here is the contract around it: state moves
 * from frame to frame, a new recording starts from a fresh state, a result that arrives
 * after a reset cannot corrupt the new recording, and a probability outside [0, 1] or a
 * failed inference is handled the way the caller relies on.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createVoiceActivity, VAD_FRAME_SAMPLES } from "./voice-activity.ts";

function frame(samples = VAD_FRAME_SAMPLES): Float32Array {
  return new Float32Array(samples);
}

describe("the voice-activity classifier", () => {
  it("hands each frame the state the previous one produced", async () => {
    const seen: number[] = [];
    const activity = createVoiceActivity<{ step: number }>({
      initial: () => ({ step: 0 }),
      infer: async (_frame, state) => {
        seen.push(state.step);
        return { probability: 0.8, state: { step: state.step + 1 } };
      },
    });

    await activity.classify(frame());
    await activity.classify(frame());

    assert.deepEqual(seen, [0, 1]);
  });

  it("starts a new recording from the initial state", async () => {
    const seen: number[] = [];
    const activity = createVoiceActivity<{ step: number }>({
      initial: () => ({ step: 0 }),
      infer: async (_frame, state) => {
        seen.push(state.step);
        return { probability: 0.8, state: { step: state.step + 1 } };
      },
    });

    await activity.classify(frame());
    activity.reset();
    await activity.classify(frame());

    assert.deepEqual(seen, [0, 0]);
  });

  it("does not carry a result that arrives after a reset", async () => {
    let finish!: (value: { probability: number; state: { step: number } }) => void;
    const pendingInference = new Promise<{ probability: number; state: { step: number } }>(
      (resolve) => {
        finish = resolve;
      }
    );

    const activity = createVoiceActivity<{ step: number }>({
      initial: () => ({ step: 0 }),
      infer: () => pendingInference,
    });

    const inFlight = activity.classify(frame());
    activity.reset();
    const fresh = activity.state();

    finish({ probability: 1, state: { step: 99 } });
    assert.equal(await inFlight, 1);

    assert.equal(
      activity.state(),
      fresh,
      "a result from the previous recording must not become the next recording's state"
    );
    assert.notEqual(activity.state().step, 99);
  });

  it("clamps a probability the model cannot express", async () => {
    const answer = (probability: number) =>
      createVoiceActivity<null>({
        initial: () => null,
        infer: async () => ({ probability, state: null }),
      });

    assert.equal(await answer(1.5).classify(frame()), 1);
    assert.equal(await answer(-0.2).classify(frame()), 0);
    assert.equal(await answer(Number.NaN).classify(frame()), 0);
    assert.equal(await answer(Number.POSITIVE_INFINITY).classify(frame()), 0);
    assert.equal(await answer(0.42).classify(frame()), 0.42);
  });

  it("refuses a frame the model cannot read", async () => {
    const activity = createVoiceActivity<null>({
      initial: () => null,
      infer: async () => ({ probability: 0, state: null }),
    });

    await assert.rejects(
      activity.classify(frame(VAD_FRAME_SAMPLES - 1)),
      /reads 512-sample frames/
    );
  });

  it("lets an inference failure reach the caller", async () => {
    const activity = createVoiceActivity<null>({
      initial: () => null,
      infer: async () => {
        throw new Error("the model is gone");
      },
    });

    await assert.rejects(activity.classify(frame()), /the model is gone/);
  });
});
