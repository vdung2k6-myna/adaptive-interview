/**
 * The speech-activity classifier, above the model and below the recorder.
 *
 * The model is stateful: Silero carries a tensor between frames, and a frame classified
 * with the previous recording's state is a different answer. This module owns exactly
 * that — the state, the frame contract, and the reset — and leaves the tensors and the
 * runtime to the caller through `infer`. That split is what lets the suite hold the
 * behavior: a test injects an inference function and never loads a model.
 *
 * **A reset is a generation, not just a field clear.** Classification is asynchronous;
 * a recording can end and a new one begin while a frame is in flight. A result that
 * belongs to the old recording must not be written back over the new one's state, so
 * `reset()` advances a generation and a late result is discarded rather than applied.
 *
 * Inference failures propagate. The caller decides what a missing classifier means
 * (this change degrades to the level gate); swallowing the error here would make a
 * broken model look like a confident "not speech" and silently stop every turn.
 */

/** What the model reads. Mirrors the resampler's frame, stated once more at the seam. */
export const VAD_FRAME_SAMPLES = 512;

/** Above this probability a frame counts as speech. */
export const VAD_SPEECH_THRESHOLD = 0.5;

export interface InferenceResult<State> {
  /** The model's speech probability for this frame. Clamped by this module. */
  probability: number;
  /** The state to hand the next frame. Opaque here; the caller owns its shape. */
  state: State;
}

export interface VoiceActivity<State> {
  /**
   * Classify one frame. Rejects when the frame is the wrong size or `infer` throws.
   * A result that arrives after a `reset()` is answered but not carried forward.
   */
  classify(frame: Float32Array): Promise<number>;
  /** Start a new recording: forget the state and abandon any result in flight. */
  reset(): void;
  /** The current state, for a test and for diagnostics. */
  state(): State;
}

export function createVoiceActivity<State>(options: {
  /** A fresh state for a new recording. Must not share mutable buffers with a prior one. */
  initial: () => State;
  /** The model call. Implemented by the worker, injected so tests need no runtime. */
  infer: (frame: Float32Array, state: State) => Promise<InferenceResult<State>>;
  frameSamples?: number;
}): VoiceActivity<State> {
  const frameSamples = options.frameSamples ?? VAD_FRAME_SAMPLES;
  if (!(frameSamples > 0)) {
    throw new Error(`a classifier needs a positive frame size, got ${frameSamples}`);
  }

  let state = options.initial();
  let generation = 0;

  /** A probability the model cannot express is not speech, and never a NaN vote. */
  const clamp = (probability: number): number =>
    Number.isFinite(probability) ? Math.min(1, Math.max(0, probability)) : 0;

  return {
    async classify(frame) {
      if (frame.length !== frameSamples) {
        throw new Error(
          `the classifier reads ${frameSamples}-sample frames, got ${frame.length}`
        );
      }

      const mine = generation;
      const result = await options.infer(frame, state);

      // A late result belongs to the recording that was reset. It is still the
      // answer to this frame, but it must not become the next recording's state.
      if (mine === generation) {
        state = result.state;
      }

      return clamp(result.probability);
    },

    reset() {
      generation++;
      state = options.initial();
    },

    state() {
      return state;
    },
  };
}
