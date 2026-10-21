/**
 * When a recording has heard enough, and when it should stop listening.
 *
 * This is the decision the recorder makes from the samples the capture worklet already
 * delivers. It is pure — an RMS reading and a sample count in, one verdict out — because
 * that is the half of the recorder a test can hold without a browser, and because the
 * clock has to come from the samples rather than a display timer: a background tab
 * throttles `setInterval`, and a throttled timer must not be able to leave a microphone
 * open.
 *
 * The gate ported from the gadget's endpointer (`adaptive-interview-bridge`,
 * `src/listening.ts`): the room is estimated from the quiet frames' low percentile, and
 * the gate is `max(minRms, floor × ratio)`. Only unvoiced frames feed that estimate, so
 * a person speaking cannot raise the floor above their own voice and cut themselves
 * off. A single loud block is not speech — the run has to last `minSpeechMs`, which is
 * why a door slam does not become a turn.
 *
 * The four verdicts are deliberately distinct. `end` is a spoken turn finishing;
 * `giveup` is a recording nobody spoke into; `cap` is an abandoned recording reaching
 * its maximum. The recorder treats the first two differently — one is sent, one is
 * discarded — so folding them into a boolean would lose the difference the product
 * depends on.
 *
 * **The gate is not the only vote.** A frame can also be handed a speech probability
 * from the voice-activity model, and then it counts as voiced only when it is above the
 * gate *and* the model says speech. The gate answers "louder than this room"; the model
 * answers "a voice" — and in a noisy room those are different questions. An absent
 * probability is the level gate alone, which is what a deployment with the classifier
 * disabled, or one whose model failed to load, runs on.
 */

import {
  ENDPOINTER_TUNING,
  type EndpointerTuning,
  type RecordingLimits,
} from "./recording-limits.ts";
import { VAD_SPEECH_THRESHOLD } from "./voice-activity.ts";

export type EndpointVerdict = "wait" | "end" | "giveup" | "cap";

export interface RecordingEndpointerOptions {
  sampleRate: number;
  limits: RecordingLimits;
  tuning?: Partial<EndpointerTuning>;
}

export interface RecordingEndpointer {
  /**
   * Fold one frame in. `samples` is the frame's length, which is where elapsed time
   * comes from; `rms` is its level, in the same scale as the captured Float32 samples.
   * `speechProbability` is the voice-activity model's answer for the same frame, or
   * undefined when there is no classifier to ask (the level gate alone).
   */
  push: (rms: number, samples: number, speechProbability?: number) => EndpointVerdict;
  /** Whether sustained speech has been heard — what decides a track ending's meaning. */
  hasHeardSpeech: () => boolean;
  /** Recording time, counted from the samples handed in. */
  elapsedMs: () => number;
  /** The gate this endpointer judged its last frame against. Kept for tests and logs. */
  gate: () => number;
  /** The verdict once it has been reached, or null while waiting. */
  verdict: () => EndpointVerdict | null;
}

/** The 20th percentile of the quiet frames — the room, not the person. */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[index]!;
}

export function createRecordingEndpointer({
  sampleRate,
  limits,
  tuning: overrides,
}: RecordingEndpointerOptions): RecordingEndpointer {
  const tuning: EndpointerTuning = { ...ENDPOINTER_TUNING, ...overrides };

  /** Milliseconds per sample. A bad rate is the caller's bug; it must not yield NaN. */
  const perSampleMs = sampleRate > 0 ? 1_000 / sampleRate : 0;

  let totalSamples = 0;
  let heardSpeech = false;
  /** How long the current voiced run has lasted, since the last unvoiced frame. */
  let speechRunMs = 0;
  /** Silence since the last voiced frame, counted only once speech has been heard. */
  let silenceMs = 0;
  /** Recent quiet frames, bounded by `quietWindowMs`, and their total. */
  const quiet: { rms: number; ms: number }[] = [];
  let quietMs = 0;
  let gate = tuning.vadMinRms;
  let reached: EndpointVerdict | null = null;

  const latch = (verdict: EndpointVerdict): EndpointVerdict => {
    reached = verdict;
    return verdict;
  };

  return {
    push(rms, samples, speechProbability) {
      // A verdict is final: the recorder stops feeding an endpointer it has acted on,
      // and a stray frame in the same batch must not change what was decided.
      if (reached) return reached;

      const ms = samples * perSampleMs;
      totalSamples += samples;
      const elapsed = totalSamples * perSampleMs;

      // The gate is computed from what has been heard *before* this frame, so a frame
      // cannot vote on whether it is itself quiet.
      const floor = quietMs >= tuning.quietMinMs ? percentile(quiet.map((q) => q.rms), 0.2) : 0;
      const adaptive = Math.min(tuning.vadMaxGateRms, floor * tuning.vadFloorRatio);
      gate = Math.max(tuning.vadMinRms, adaptive);

      const voiced =
        rms >= gate &&
        (speechProbability === undefined || speechProbability >= VAD_SPEECH_THRESHOLD);

      if (voiced) {
        speechRunMs += ms;
        if (speechRunMs >= limits.minSpeechMs) heardSpeech = true;
        silenceMs = 0;
      } else {
        speechRunMs = 0;
        // Only quiet frames describe the room. A person speaking cannot raise the floor
        // above their own voice, which is what would cut them off mid-answer.
        quiet.push({ rms, ms });
        quietMs += ms;
        while (quietMs > tuning.quietWindowMs && quiet.length > 1) {
          const dropped = quiet.shift()!;
          quietMs -= dropped.ms;
        }
        // Silence only begins to count once speech has been heard; otherwise a room
        // nobody spoke into would close itself on its own quiet.
        if (heardSpeech) silenceMs += ms;
      }

      // The maximum is absolute: it ends a recording even while speech continues, which
      // is the point of an abandonment guard. It is checked first because neither a
      // giveup nor an ordinary end should describe a recording that outlived its bound.
      if (elapsed >= limits.maxMs) return latch("cap");
      if (!heardSpeech && elapsed >= limits.noSpeechMs) return latch("giveup");
      if (heardSpeech && silenceMs >= limits.silenceMs) return latch("end");
      return "wait";
    },

    hasHeardSpeech: () => heardSpeech,
    elapsedMs: () => totalSamples * perSampleMs,
    gate: () => gate,
    verdict: () => reached,
  };
}
