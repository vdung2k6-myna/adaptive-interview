/**
 * The capture-format suite. Run with Node's own runner:
 *
 *   node --test src/lib/audio/capture-format.test.ts
 *
 * The encoder is the half of a capture that can be tested without a browser, which is the reason
 * it was moved out of the recorder — so what this suite pins is what a player would read back:
 * the header's own account of the audio, and the samples actually written.
 *
 * The case worth keeping is the rate. A capture that quietly comes out at a rate nobody chose is
 * exactly how a 10 MB bound gets crossed without anyone deciding to cross it, so the encoder is
 * held to the buffer it is handed rather than to whatever it might have assumed.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { encodeWav, type PcmSource } from "./capture-format.ts";

/** A buffer as the encoder sees one: only the parts it is allowed to read. */
function pcm(channels: number[][], sampleRate: number): PcmSource {
  return {
    sampleRate,
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    getChannelData: (channel: number) => Float32Array.from(channels[channel] ?? []),
  };
}

/** A WAV read back the way a player reads one, so the assertions are about the file. */
async function readWav(blob: Blob) {
  const view = new DataView(await blob.arrayBuffer());
  const ascii = (offset: number, length: number) =>
    Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join("");

  const dataLength = view.getUint32(40, true);
  const samples: number[] = [];
  for (let offset = 44; offset < 44 + dataLength; offset += 2) {
    samples.push(view.getInt16(offset, true));
  }

  return {
    type: blob.type,
    riff: ascii(0, 4),
    wave: ascii(8, 4),
    fmt: ascii(12, 4),
    data: ascii(36, 4),
    riffChunkLength: view.getUint32(4, true),
    format: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bitDepth: view.getUint16(34, true),
    dataLength,
    bytes: view.byteLength,
    samples,
  };
}

describe("encoding a capture as WAV", () => {
  it("writes a file a player can read, 16-bit PCM", async () => {
    const wav = await readWav(encodeWav(pcm([[0, 0.5, -0.5]], 16_000)));

    assert.equal(wav.riff, "RIFF", "the container a player looks for first");
    assert.equal(wav.wave, "WAVE");
    assert.equal(wav.fmt, "fmt ");
    assert.equal(wav.data, "data");
    assert.equal(wav.format, 1, "PCM, which is the only format this writes");
    assert.equal(wav.bitDepth, 16);
    assert.equal(wav.type, "audio/wav", "the type the FormData carries to the platform");
  });

  it("states the buffer's own rate and channels, rather than an assumed pair", async () => {
    const narrowBand = await readWav(encodeWav(pcm([[0, 0]], 16_000)));
    const deviceRate = await readWav(encodeWav(pcm([[0, 0], [0, 0]], 48_000)));

    assert.equal(narrowBand.sampleRate, 16_000, "a rate nobody chose is how the bound gets crossed");
    assert.equal(narrowBand.channels, 1);
    assert.equal(narrowBand.blockAlign, 2);
    assert.equal(narrowBand.byteRate, 32_000, "32 kB a second is what a fallback turn costs");

    assert.equal(deviceRate.sampleRate, 48_000, "and a device-rate capture still says so");
    assert.equal(deviceRate.channels, 2);
    assert.equal(deviceRate.blockAlign, 4);
    assert.equal(
      deviceRate.byteRate,
      192_000,
      "which is the 10 MB-per-minute this whole change is about"
    );
  });

  it("sizes the data chunk from the samples written", async () => {
    const frames = 100;
    const wav = await readWav(
      encodeWav(pcm([Array(frames).fill(0), Array(frames).fill(0)], 48_000))
    );

    assert.equal(wav.dataLength, frames * 4, "100 stereo frames is 400 bytes of PCM16");
    assert.equal(wav.bytes, 44 + wav.dataLength, "and the file is the header plus exactly that");
    assert.equal(
      wav.riffChunkLength,
      36 + wav.dataLength,
      "the RIFF length counts everything after its own field"
    );
  });

  it("writes the samples it was given, interleaved", async () => {
    const wav = await readWav(encodeWav(pcm([[0.5, 0.25], [-0.5, 0.75]], 16_000)));

    assert.deepEqual(
      wav.samples,
      [16383, -16384, 8191, 24575],
      "frame by frame, left then right — the layout a mono capture later collapses"
    );
  });

  it("keeps both extremes representable", async () => {
    const wav = await readWav(encodeWav(pcm([[1, -1, 2, -2]], 16_000)));

    assert.deepEqual(
      wav.samples,
      [32767, -32768, 32767, -32768],
      "a sample beyond the range is clamped, and the two halves scale differently by design"
    );
  });
});
