/**
 * The resampler suite. Run with Node's own runner:
 *
 *   node --test src/lib/audio/resample.test.ts
 *
 * These pin the two properties the recorder relies on: the model receives complete
 * 512-sample frames at 16 kHz whatever the device's rate is, and a chunk boundary is
 * invisible in the output. The second is why a constant is asserted sample for sample —
 * a carry bug shows up as a step at the boundary, not as a wrong total length.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createSpeechFrameResampler,
  samplesForMs,
  SPEECH_FRAME_SAMPLES,
  SPEECH_SAMPLE_RATE,
} from "./resample.ts";

/** A mono chunk of `length` samples, all one level. */
function constant(length: number, level = 0.5): Float32Array {
  return new Float32Array(length).fill(level);
}

/** Feed a source in fixed chunks and collect everything the resampler emitted. */
function drain(
  resampler: ReturnType<typeof createSpeechFrameResampler>,
  chunks: Iterable<Float32Array>
): { frames: Float32Array[]; samples: number[] } {
  const frames: Float32Array[] = [];
  for (const chunk of chunks) frames.push(...resampler.push([chunk]));
  const samples: number[] = [];
  for (const frame of frames) samples.push(...frame);
  return { frames, samples };
}

/** Split a signal into fixed-size chunks, so boundaries are exercised. */
function* chunked(signal: Float32Array, size: number): Generator<Float32Array> {
  for (let offset = 0; offset < signal.length; offset += size) {
    yield signal.subarray(offset, Math.min(offset + size, signal.length));
  }
}

describe("the frame-sample arithmetic", () => {
  it("turns the analysis frame's duration into samples at each source rate", () => {
    assert.equal(samplesForMs(48_000, 32), 1_536);
    assert.equal(samplesForMs(44_100, 32), 1_411);
    assert.equal(samplesForMs(16_000, 32), SPEECH_FRAME_SAMPLES);
    // The older 20 ms aggregation, kept as the check that nothing rounds silently.
    assert.equal(samplesForMs(48_000, 20), 960);
  });

  it("refuses a rate or duration that is not positive", () => {
    assert.throws(() => samplesForMs(0, 32), /positive rate and duration/);
    assert.throws(() => samplesForMs(48_000, 0), /positive rate and duration/);
  });
});

describe("the speech-frame resampler", () => {
  it("turns a 32 ms chunk at 48 kHz into one 512-sample frame", () => {
    const resampler = createSpeechFrameResampler(48_000);
    const frames = resampler.push([constant(1_536)]);

    assert.equal(frames.length, 1);
    assert.equal(frames[0]!.length, SPEECH_FRAME_SAMPLES);
    for (const sample of frames[0]!) assert.ok(Math.abs(sample - 0.5) < 1e-6);
  });

  it("keeps a 44.1 kHz source's output clock over one second", () => {
    const resampler = createSpeechFrameResampler(44_100);
    const source = constant(44_100);
    const { frames } = drain(resampler, chunked(source, 128));

    // 44 100 / 16 000 is not an integer. One second is exactly 16 000 output
    // samples; frames hold whole 512s and the rest is carried.
    assert.equal(frames.length, 31);
    assert.equal(frames.length * SPEECH_FRAME_SAMPLES + resampler.pendingSamples(), 16_000);
    assert.equal(resampler.pendingSamples(), 16_000 - 31 * SPEECH_FRAME_SAMPLES);
  });

  it("makes a chunk boundary invisible", () => {
    const resampler = createSpeechFrameResampler(48_000);
    const { samples } = drain(resampler, chunked(constant(4_800, 0.25), 128));

    assert.ok(samples.length > 0);
    for (const sample of samples) assert.ok(Math.abs(sample - 0.25) < 1e-6);
  });

  it("keeps a sine continuous across chunk boundaries", () => {
    const sourceRate = 48_000;
    const source = new Float32Array(sourceRate);
    for (let index = 0; index < source.length; index++) {
      source[index] = 0.8 * Math.sin((2 * Math.PI * 440 * index) / sourceRate);
    }

    const resampler = createSpeechFrameResampler(sourceRate);
    const { samples } = drain(resampler, chunked(source, 128));

    // A 440 Hz tone at 16 kHz crosses zero 880 times a second. Only whole frames are
    // emitted, so the count is scaled by the samples actually emitted rather than by
    // the source's length. Then check no adjacent pair jumped further than the tone
    // itself can.
    let crossings = 0;
    let largestStep = 0;
    for (let index = 1; index < samples.length; index++) {
      if ((samples[index - 1]! < 0) !== (samples[index]! < 0)) crossings++;
      largestStep = Math.max(largestStep, Math.abs(samples[index]! - samples[index - 1]!));
    }

    const expected = Math.round((880 * samples.length) / SPEECH_SAMPLE_RATE);
    assert.ok(
      Math.abs(crossings - expected) <= 2,
      `expected about ${expected} zero crossings over ${samples.length} samples, saw ${crossings}`
    );
    // The tone's own steepest 16 kHz sample step is about 0.138; a seam would be
    // larger than that.
    assert.ok(largestStep < 0.2, `expected a smooth tone, saw a step of ${largestStep}`);
  });

  it("downmixes channels before resampling", () => {
    const resampler = createSpeechFrameResampler(48_000);
    const left = constant(1_536, 0.5);
    const right = constant(1_536, -0.5);

    const frames = resampler.push([left, right]);
    assert.equal(frames.length, 1);
    for (const sample of frames[0]!) assert.ok(Math.abs(sample) < 1e-6);
  });

  it("drops the carry on reset", () => {
    const resampler = createSpeechFrameResampler(48_000);
    resampler.push([constant(300, 0.7)]);
    assert.ok(resampler.pendingSamples() > 0);

    resampler.reset();
    assert.equal(resampler.pendingSamples(), 0);

    const frames = resampler.push([constant(1_536, 0.7)]);
    assert.equal(frames.length, 1);
    for (const sample of frames[0]!) assert.ok(Math.abs(sample - 0.7) < 1e-6);
  });

  it("refuses a source rate that is not positive", () => {
    assert.throws(() => createSpeechFrameResampler(0), /positive source rate/);
    assert.throws(() => createSpeechFrameResampler(-1), /positive source rate/);
  });
});
