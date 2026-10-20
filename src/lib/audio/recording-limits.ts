/**
 * How long each surface waits before a recording ends on its own, and where a
 * deployment states those waits.
 *
 * The recorder is shared by the interview and the voice agent, and the two are not the
 * same kind of conversation. The interview asks for "a minute or two"
 * (`interview/answer-pacing`), so a pause is a person thinking and the silence that ends
 * an answer has to be long. The voice agent holds a conversation, where a pause is more
 * often the end of a turn. The defaults below encode that difference; a deployment that
 * disagrees changes it without touching the recorder.
 *
 * These are build-time client settings (`NEXT_PUBLIC_*`), for the reason
 * `windowed-ingest.ts` gives: the recorder runs in the browser, so the values are
 * inlined when the client is built. Restarting the API does not change them; a
 * deployment that wants a three-second silence on the voice agent sets
 * `NEXT_PUBLIC_VOICE_AGENT_SILENCE_MS=3000` and rebuilds the client.
 *
 * The maximum durations are abandonment guards, not pacing rules. The interview's
 * default of ten minutes is deliberately far above the expected answer and inside the
 * API's fifteen minute transcript buffer (`transcriptBuffer.retentionMs`), so an answer
 * that matches the stated expectation can never reach it — reaching it means the
 * recording was abandoned, not that the person talked too long. A three-minute bound
 * sits inside a plausible long answer and would read as the expected length being
 * enforced, which the answer-pacing spec forbids; a deployment that lowers the bound
 * takes that reading on itself.
 */

export interface RecordingLimits {
  /** Speech that must be sustained before anything counts as an utterance. */
  minSpeechMs: number;
  /** Silence after speech that ends the recording. */
  silenceMs: number;
  /** A recording that has heard no speech at all by this point is discarded. */
  noSpeechMs: number;
  /** An abandonment guard. Reaching it ends the recording through the same path. */
  maxMs: number;
}

/** A positive whole number from a setting, or the default. */
function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** The settings a build may carry, already read from their environment variables. */
export interface RecordingLimitSettings {
  /** Shared by both surfaces: what counts as sustained speech. */
  minSpeechMs?: string;
  voiceAgent: {
    silenceMs?: string;
    noSpeechMs?: string;
    maxMs?: string;
  };
  interview: {
    silenceMs?: string;
    noSpeechMs?: string;
    maxMs?: string;
  };
}

/**
 * The limits a build carries, with each unset or unusable setting taking its default.
 *
 * Pure, so a test can state a deployment's settings directly instead of having to
 * re-import this module with a different environment.
 */
export function readRecordingLimits(settings: RecordingLimitSettings): {
  voiceAgent: RecordingLimits;
  interview: RecordingLimits;
} {
  return {
    voiceAgent: {
      minSpeechMs: positiveInt(settings.minSpeechMs, 300),
      silenceMs: positiveInt(settings.voiceAgent.silenceMs, 1_000),
      noSpeechMs: positiveInt(settings.voiceAgent.noSpeechMs, 15_000),
      maxMs: positiveInt(settings.voiceAgent.maxMs, 2 * 60_000),
    },
    interview: {
      minSpeechMs: positiveInt(settings.minSpeechMs, 300),
      silenceMs: positiveInt(settings.interview.silenceMs, 3_000),
      noSpeechMs: positiveInt(settings.interview.noSpeechMs, 15_000),
      maxMs: positiveInt(settings.interview.maxMs, 10 * 60_000),
    },
  };
}

export const RECORDING_LIMITS = readRecordingLimits({
  minSpeechMs: process.env.NEXT_PUBLIC_RECORDING_MIN_SPEECH_MS,
  voiceAgent: {
    silenceMs: process.env.NEXT_PUBLIC_VOICE_AGENT_SILENCE_MS,
    noSpeechMs: process.env.NEXT_PUBLIC_VOICE_AGENT_NO_SPEECH_MS,
    maxMs: process.env.NEXT_PUBLIC_VOICE_AGENT_MAX_RECORDING_MS,
  },
  interview: {
    silenceMs: process.env.NEXT_PUBLIC_INTERVIEW_SILENCE_MS,
    noSpeechMs: process.env.NEXT_PUBLIC_INTERVIEW_NO_SPEECH_MS,
    maxMs: process.env.NEXT_PUBLIC_INTERVIEW_MAX_RECORDING_MS,
  },
});

/**
 * The endpointer's own knobs: how a frame becomes speech or room.
 *
 * The gate is `max(vadMinRms, floor × vadFloorRatio)` from the quiet frames alone, so
 * sustained speech cannot raise the floor above itself and cut the speaker off. The
 * floor is clamped by `vadMaxGateRms` so a moderately noisy room does not mask a quiet
 * speaker; in a room loud enough to sit above that clamp, everything sounds voiced and
 * the maximum duration is what ends the recording.
 *
 * `frameMs` is the aggregation the recorder does before calling the endpointer: a
 * 128-sample worklet block is about 2.7 ms at 48 kHz, which is finer than any speech
 * decision needs.
 */
export interface EndpointerTuning {
  vadMinRms: number;
  vadFloorRatio: number;
  vadMaxGateRms: number;
  quietWindowMs: number;
  quietMinMs: number;
  frameMs: number;
}

export const ENDPOINTER_TUNING: EndpointerTuning = {
  vadMinRms: 0.006,
  vadFloorRatio: 2.5,
  vadMaxGateRms: 0.06,
  quietWindowMs: 600,
  quietMinMs: 400,
  frameMs: 20,
};
