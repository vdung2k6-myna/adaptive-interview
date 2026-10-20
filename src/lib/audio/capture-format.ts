/**
 * What a capture is: the bytes a recording is made of.
 *
 * The recorder has to hand the platform something `audio.cpp` will transcribe, and what it hands
 * over is uncompressed — 48 kHz stereo PCM16 is 192,000 B/s, so about a minute of speech is
 * 10 MB, which is the bound the transport in front of the API imposes on a request body. So what
 * a capture is, and how large it comes out, is worth being able to state and to test.
 *
 * **Why this is here and not in the component.** This repository's tests run over `src/lib/**`
 * and nothing else. The encoding below is a pure function of a buffer, so it is the one part of
 * the capture a test can hold; the recorder keeps the half that needs a browser — decoding a
 * recorded Blob, and resampling it — because an `AudioContext` is not available to the suite.
 *
 * Nothing here decides which channel count or sample rate to use: it writes what it is given.
 * A capture that is the wrong shape for the transport is a decision made by the caller, and
 * hiding one here would make that decision untestable.
 */

/** The parts of an `AudioBuffer` the encoder reads — which is all it may depend on, since a
 *  test has no Web Audio to build a real one. */
export interface PcmSource {
  readonly sampleRate: number;
  readonly numberOfChannels: number;
  readonly length: number;
  getChannelData(channel: number): Float32Array;
}

/** A WAV header: 44 bytes of RIFF, fmt and the start of the data chunk. */
const WAV_HEADER_BYTES = 44;
const WAV_BIT_DEPTH = 16;
const WAV_FORMAT_PCM = 1;

/**
 * Encode a buffer as a WAV, 16-bit PCM, interleaved.
 *
 * The header states the buffer's own sample rate and channel count rather than a rate chosen
 * here, so the same call encodes a device-rate capture and a narrow-band one, and the two are
 * told apart by what a player reads back.
 */
export function encodeWav(buffer: PcmSource): Blob {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = WAV_BIT_DEPTH / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;

  const bytes = new ArrayBuffer(WAV_HEADER_BYTES + dataLength);
  new Uint8Array(bytes).set(new Uint8Array(wavHeader(dataLength, sampleRate, numberOfChannels)));
  const view = new DataView(bytes);

  const channels: Float32Array[] = [];
  for (let channel = 0; channel < numberOfChannels; channel++) {
    channels.push(buffer.getChannelData(channel));
  }

  let offset = WAV_HEADER_BYTES;
  for (let frame = 0; frame < buffer.length; frame++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      /* The two halves are scaled differently — a negative sample by 0x8000 and a positive one
       * by 0x7fff — so that -1 and 1 are both representable in two's complement. */
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([bytes], { type: "audio/wav" });
}

/**
 * A WAV header for 16-bit PCM, stating a data length the caller already knows.
 *
 * Split out because a recording assembled from pieces knows that length before any of the samples
 * are joined — it is the sum of the pieces — and writing it here keeps the RIFF layout in one
 * module rather than one per caller. `encodeWav` writes the same header in front of a buffer it is
 * about to fill.
 */
export function wavHeader(
  dataLength: number,
  sampleRate: number,
  numberOfChannels = 1
): ArrayBuffer {
  const bytesPerSample = WAV_BIT_DEPTH / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  const bytes = new ArrayBuffer(WAV_HEADER_BYTES);
  const view = new DataView(bytes);

  writeAscii(view, 0, "RIFF");
  /* Size of everything after this field, which is the header remainder plus the samples. */
  view.setUint32(4, WAV_HEADER_BYTES - 8 + dataLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  /* The fmt chunk is 16 bytes for PCM. */
  view.setUint32(16, 16, true);
  view.setUint16(20, WAV_FORMAT_PCM, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  /* How many bytes a second of this is — the number the transport measures. */
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, WAV_BIT_DEPTH, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataLength, true);

  return bytes;
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
