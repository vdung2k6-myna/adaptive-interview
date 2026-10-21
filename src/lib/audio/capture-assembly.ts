/**
 * Joining the pieces of a recording that was converted as it arrived.
 *
 * The recorder no longer keeps what the browser produced and decodes it at the end. It converts one
 * window at a time into the form the platform is sent — 16 kHz, one channel, 16-bit PCM — and this
 * is what turns those pieces back into the one file a turn uploads.
 *
 * It is here, and not in the component, for the reason `capture-format.ts` gives: the join is a
 * pure function of the pieces, so it is the half of the capture the suite can hold. The header is
 * written once, with the length the recording ended up having, and the pieces are laid end to end
 * with no second copy of the audio taken to do it.
 */

import { wavHeader } from "./capture-format.ts";

/** The shape a capture is sent in — the band speech is recognised from. */
export const CAPTURE_SAMPLE_RATE = 16_000;
export const CAPTURE_CHANNELS = 1;

/** One converted window: 16 kHz mono 16-bit little-endian PCM, with no container of its own. */
export type CaptureFrame = Uint8Array;

/**
 * Assemble a recording from the frames it was converted into, in the order they were spoken.
 *
 * The data length is the sum of the frames, so the header is written once rather than patched
 * afterwards, and the Blob is built from the header and the frames themselves — the pieces are
 * referenced, not copied into one buffer, which is what keeps the assembly from doubling the
 * memory it is meant to save.
 */
export function assembleCapture(frames: readonly CaptureFrame[]): Blob {
  const dataLength = frames.reduce((total, frame) => total + frame.byteLength, 0);
  const header = wavHeader(dataLength, CAPTURE_SAMPLE_RATE, CAPTURE_CHANNELS);

  // The frames are views over buffers this module does not own, which is exactly what a Blob part
  // may be; the cast is for the DOM's `ArrayBuffer`-specific typing, not for the data.
  const parts = [header, ...(frames as readonly BlobPart[])];
  return new Blob(parts, { type: "audio/wav" });
}
