/**
 * The Silero session and the tensors it reads, without a worker around them.
 *
 * The worker is a transport detail; this is the part that has to be right about the
 * model. Keeping it here means a test can run the pinned ONNX file through the same
 * tensor code the worker uses — ONNX Runtime's web build runs in Node as well as in a
 * browser — instead of the suite being blind to every line below `onmessage`.
 *
 * The runtime is injected rather than imported so this module does not pick an entry
 * point: the worker loads `onnxruntime-web/wasm` (the external-WASM build the service
 * worker caches), while a test loads the Node resolution of the same package.
 *
 * The model's contract, read from the pinned file: `input` float32 [1, 512], `state`
 * float32 [2, 1, 128], `sr` int64 scalar; it answers `output` [1, 1] and `stateN`
 * [2, 1, 128]. The state is what makes a frame's answer depend on the frames before it.
 */

import { createVoiceActivity, type VoiceActivity } from "./voice-activity.ts";

/** Where `scripts/copy-vad-assets.mjs` put the model. */
export const MODEL_URL = "/vad/silero_vad.onnx";

/** The model's own `sr` input: its frames are 512 samples at this rate. */
export const VAD_SAMPLE_RATE = 16_000;

/** What the pinned model declares: [2, 1, 128] of float32. */
export const VAD_STATE_LENGTH = 2 * 1 * 128;

/** The slice of ONNX Runtime this module uses. */
export interface OrtTensorLike {
  readonly data: Float32Array | BigInt64Array | readonly number[] | readonly string[];
}

export interface OrtSessionLike {
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensorLike>>;
}

export interface OrtRuntimeLike {
  Tensor: new (
    type: string,
    data: Float32Array | BigInt64Array,
    dims: readonly number[]
  ) => unknown;
  InferenceSession: {
    create(
      bytes: Uint8Array,
      options: { executionProviders: readonly string[] }
    ): Promise<OrtSessionLike>;
  };
}

export async function createSileroClassifier(
  ort: OrtRuntimeLike,
  modelBytes: Uint8Array
): Promise<VoiceActivity<Float32Array>> {
  const session = await ort.InferenceSession.create(modelBytes, {
    executionProviders: ["wasm"],
  });

  return createVoiceActivity<Float32Array>({
    initial: () => new Float32Array(VAD_STATE_LENGTH),
    infer: async (frame, state) => {
      const output = await session.run({
        input: new ort.Tensor("float32", frame, [1, frame.length]),
        state: new ort.Tensor("float32", state, [2, 1, 128]),
        sr: new ort.Tensor(
          "int64",
          BigInt64Array.from([BigInt(VAD_SAMPLE_RATE)]),
          []
        ),
      });

      const probability = Number(output.output!.data[0]);
      // Copied: the output tensor's buffer belongs to the runtime, and the next run
      // is free to reuse it.
      return {
        probability,
        state: new Float32Array(output.stateN!.data as Float32Array),
      };
    },
  });
}
