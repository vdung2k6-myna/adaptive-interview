/**
 * The assembly suite. Run with Node's own runner:
 *
 *   node --test src/lib/audio/capture-assembly.test.ts
 *
 * What this pins is what a player reads back from the uploaded file: the header's own account of
 * the recording, and the samples, in the order they were spoken. The joins are the part of the
 * capture a test can hold without a browser, and the second requirement in the spec is exactly
 * about them — nothing dropped, nothing counted twice.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { assembleCapture } from "./capture-assembly.ts";

/** The file as a player reads it: the header and the samples behind it. */
async function read(blob: Blob): Promise<{ bytes: Uint8Array; view: DataView }> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes, view: new DataView(bytes.buffer) };
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

describe("assembleCapture", () => {
  it("states the capture's own shape: 16 kHz, one channel, 16-bit", async () => {
    const { bytes, view } = await read(assembleCapture([new Uint8Array([1, 2])]));

    assert.equal(ascii(bytes, 0, 4), "RIFF");
    assert.equal(ascii(bytes, 8, 4), "WAVE");
    assert.equal(ascii(bytes, 12, 4), "fmt ");
    assert.equal(view.getUint16(20, true), 1, "PCM");
    assert.equal(view.getUint16(22, true), 1, "one channel");
    assert.equal(view.getUint32(24, true), 16_000, "16 kHz");
    assert.equal(view.getUint32(28, true), 32_000, "and 32,000 bytes of it a second");
    assert.equal(view.getUint16(34, true), 16, "16-bit samples");
    assert.equal(ascii(bytes, 36, 4), "data");
  });

  it("states the length the recording ended up having, not the number of pieces", async () => {
    const { view } = await read(
      assembleCapture([new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5, 6, 7])])
    );

    assert.equal(view.getUint32(40, true), 7, "the data chunk holds every byte of every frame");
    assert.equal(view.getUint32(4, true), 36 + 7, "and RIFF counts from the header remainder");
  });

  it("lays the frames end to end, in the order it was given them", async () => {
    const frames = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5]),
      new Uint8Array([6, 7, 8, 9]),
    ];

    const { bytes } = await read(assembleCapture(frames));

    assert.deepEqual([...bytes.subarray(44)], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("is the concatenation and nothing else, down to the byte", async () => {
    // A known-good file written out independently of the assembly, so this is a comparison
    // against what the format says rather than against the code's own answer. The frames are of
    // unequal length and one holds an odd number of bytes.
    const frames = [new Uint8Array([0xaa]), new Uint8Array([0xbb, 0xcc, 0xdd])];
    const expected = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x28, 0x00, 0x00, 0x00, // 36 + 4 bytes of data
      0x57, 0x41, 0x56, 0x45, // WAVE
      0x66, 0x6d, 0x74, 0x20, // fmt
      0x10, 0x00, 0x00, 0x00, // 16-byte fmt chunk
      0x01, 0x00, // PCM
      0x01, 0x00, // mono
      0x80, 0x3e, 0x00, 0x00, // 16,000 Hz
      0x00, 0x7d, 0x00, 0x00, // 32,000 bytes/s
      0x02, 0x00, // 2 bytes per frame
      0x10, 0x00, // 16 bits per sample
      0x64, 0x61, 0x74, 0x61, // data
      0x04, 0x00, 0x00, 0x00, // 4 bytes of it
      0xaa, 0xbb, 0xcc, 0xdd, // the frames themselves
    ]);

    const { bytes } = await read(assembleCapture(frames));

    assert.deepEqual([...bytes], [...expected]);
  });

  it("holds a recording of many frames together", async () => {
    const frames = Array.from({ length: 400 }, (_, index) => new Uint8Array([index % 256, 1]));

    const { bytes, view } = await read(assembleCapture(frames));

    assert.equal(bytes.length, 44 + 800, "the file is the header plus every frame");
    assert.equal(view.getUint32(40, true), 800);
    assert.deepEqual(
      [...bytes.subarray(44, 48)],
      [0, 1, 1, 1],
      "the first frames are where they were, and none was dropped"
    );
    assert.deepEqual([...bytes.subarray(44 + 796)], [398 % 256, 1, 399 % 256, 1], "so is the last");
  });
});
