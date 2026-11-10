/**
 * The audio a voice-agent reply was delivered in.
 *
 * A turn's `sentence` events carry each segment as base64 WAV, and the page
 * plays them in index order. Replay must reproduce that same audio rather than
 * synthesize the text again — a deployment that shapes the agent's voice would
 * otherwise answer in one voice and replay in another.
 *
 * Pure, and separate from the page, so the ordering rule can be tested without
 * a browser: a turn may deliver indices out of order, and one index is one
 * segment no matter how many times it was seen.
 */
export function collectReplayAudio(segments: ReadonlyMap<number, string>): string[] {
  return [...segments.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, audio]) => audio);
}
