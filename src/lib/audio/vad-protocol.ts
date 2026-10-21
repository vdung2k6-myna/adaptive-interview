/**
 * The wire between the recorder and the inference worker.
 *
 * Types only, imported by both sides, so a request that gains a field fails to compile
 * on the reader rather than arriving as `undefined`. Frames cross as a transferred
 * `Float32Array` buffer: the recorder has no use for the samples after offering them,
 * and copying 2 KB thirty times a second is a cost with no benefit.
 */

export type VadRequest =
  /** Load the model. Idempotent; a second call answers from the loaded session. */
  | { type: "init" }
  /** Start a new recording: the model's carried state belongs to the old one. */
  | { type: "reset" }
  /** One 512-sample frame at 16 kHz. `id` is the client's in-flight number. */
  | { type: "classify"; id: number; frame: Float32Array };

export type VadResponse =
  | { type: "ready" }
  | { type: "failed"; message: string }
  | { type: "probability"; id: number; probability: number }
  | { type: "classify-failed"; id: number; message: string };
