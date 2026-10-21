/**
 * Turning captured audio into the frames a speech-activity model consumes.
 *
 * The recorder captures at the `AudioContext`'s rate — usually 48 kHz, sometimes
 * 44.1 kHz — and in whatever channel count the microphone offers. Silero VAD reads
 * exactly 512 samples at 16 kHz, mono, and carries its own state between calls, so it
 * cannot be fed a 20 ms block or an arbitrary rate. This module is the boundary: it
 * downmixes, resamples, and emits only whole frames.
 *
 * **Why a box filter and not linear interpolation.** The direction here is always
 * downward (a microphone's rate to 16 kHz), and linear interpolation at downward
 * ratios would simply pick source samples and alias everything above 8 kHz into the
 * band the model judges. Averaging every source sample that falls inside an output
 * sample's interval is a crude low-pass, but it is one, and it costs a few adds. It
 * also preserves a constant exactly, which is what makes a chunk boundary invisible
 * to the model.
 *
 * **Why the position is fractional and carried.** Chunk lengths are whatever the
 * audio graph delivers, and 44.1 kHz does not divide into 16 kHz. Resetting the
 * position at each chunk would drift the output rate; carrying it keeps the output
 * clock tied to the source clock over the whole recording.
 *
 * Pure: no `AudioContext`, no clock, no model. The suite holds it.
 */

/** What the model reads. */
export const SPEECH_SAMPLE_RATE = 16_000;
export const SPEECH_FRAME_SAMPLES = 512;

/**
 * How many samples `durationMs` of audio is at `sampleRate`.
 *
 * Exported because the recorder aggregates the same duration from the source rate and
 * the tests state the same arithmetic: a frame that is 32 ms at 44.1 kHz is 1 411
 * samples, not 1 536, and rounding it here keeps every caller agreeing on the frame.
 */
export function samplesForMs(sampleRate: number, durationMs: number): number {
  if (!(sampleRate > 0) || !(durationMs > 0)) {
    throw new Error(`a frame needs a positive rate and duration, got ${sampleRate} Hz / ${durationMs} ms`);
  }
  return Math.max(1, Math.round((sampleRate * durationMs) / 1_000));
}

export interface SpeechFrameResampler {
  /** The rate the captured chunks are in. Stated so a caller can log it. */
  readonly sourceRate: number;
  /**
   * Fold one captured chunk in and return the frames it completed. A chunk may
   * complete none, one, or several; a partial frame is held until the next chunk.
   */
  push(channels: readonly Float32Array[]): Float32Array[];
  /** Drop the carry. A new recording must not inherit the last one's tail. */
  reset(): void;
  /** Samples held toward the next frame. Diagnostic, and what a test asserts. */
  pendingSamples(): number;
}

/** The average of the channels, because the model reads one. */
function downmix(channels: readonly Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0]!;

  // Devices can hand over channels of different lengths mid-stream; the shorter
  // one is the only part both channels actually cover.
  let length = channels[0]!.length;
  for (const channel of channels) length = Math.min(length, channel.length);

  const mono = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    let sum = 0;
    for (const channel of channels) sum += channel[index]!;
    mono[index] = sum / channels.length;
  }
  return mono;
}

export function createSpeechFrameResampler(
  sourceRate: number,
  options: { targetRate?: number; frameSamples?: number } = {}
): SpeechFrameResampler {
  if (!(sourceRate > 0)) {
    throw new Error(`a resampler needs a positive source rate, got ${sourceRate}`);
  }

  const targetRate = options.targetRate ?? SPEECH_SAMPLE_RATE;
  const frameSamples = options.frameSamples ?? SPEECH_FRAME_SAMPLES;
  if (!(targetRate > 0) || !(frameSamples > 0)) {
    throw new Error("the target rate and frame size must be positive");
  }

  /** Source samples per output sample. Always a ratio, never rounded. */
  const step = sourceRate / targetRate;

  let carry = new Float32Array(0);
  /** Fractional read position into `carry`, in source samples. */
  let position = 0;
  let pending = new Float32Array(0);

  /**
   * Append the newly produced samples to whatever a previous chunk left, and hand
   * back only the whole frames.
   */
  const emitFrames = (produced: number[]): Float32Array[] => {
    if (produced.length === 0) return [];

    const merged = new Float32Array(pending.length + produced.length);
    merged.set(pending, 0);
    merged.set(produced, pending.length);

    const frames: Float32Array[] = [];
    let offset = 0;
    while (offset + frameSamples <= merged.length) {
      frames.push(merged.slice(offset, offset + frameSamples));
      offset += frameSamples;
    }

    pending = merged.slice(offset);
    return frames;
  };

  return {
    sourceRate,

    push(channels) {
      const mono = downmix(channels);
      if (mono.length === 0) return [];

      const buffer = new Float32Array(carry.length + mono.length);
      buffer.set(carry, 0);
      buffer.set(mono, carry.length);

      const produced: number[] = [];

      // A whole output sample needs the source interval [position, position + step)
      // fully inside the buffer: the last source index it touches is
      // ceil(position + step) - 1.
      while (Math.ceil(position + step) <= buffer.length) {
        const start = position;
        const end = position + step;
        let weighted = 0;

        // Each source sample contributes the share of itself that the output
        // interval covers. A box, with the fractional ends handled honestly rather
        // than by rounding the ratio.
        for (let index = Math.floor(start); index < Math.ceil(end); index++) {
          const overlap = Math.min(end, index + 1) - Math.max(start, index);
          if (overlap > 0) weighted += buffer[index]! * overlap;
        }

        produced.push(weighted / step);
        position = end;
      }

      // Drop samples no future interval can reach. The position becomes relative to
      // the new buffer, which begins where the dropped samples ended.
      const drop = Math.floor(position);
      if (drop > 0) {
        carry = buffer.slice(drop);
        position -= drop;
      } else {
        carry = buffer;
      }

      return emitFrames(produced);
    },

    reset() {
      carry = new Float32Array(0);
      position = 0;
      pending = new Float32Array(0);
    },

    pendingSamples() {
      return pending.length;
    },
  };
}
