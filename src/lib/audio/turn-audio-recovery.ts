/**
 * The client half of segment-audio recovery (design.md D3).
 *
 * A streamed answer arrives as segments, each fetched as it is announced. Any of
 * them can fail to arrive — the file may have been swept server-side, a socket
 * may drop — and the queue's own rule is to skip it and carry on. That rule is
 * right for the segment and wrong for the answer: skipping leaves a gap where a
 * sentence should have been, or, when every segment fails, leaves the whole
 * answer unspoken.
 *
 * The turn's canonical recording covers the whole answer, so it can stand in for
 * whatever failed. This module owns the rules that need to be reasoned about in
 * one place — that the canonical is played at most once per turn, and that a turn
 * which cannot be heard at all is reported rather than swallowed — and nothing
 * else. It imports no values and takes its effects as parameters, so it runs
 * under Node's own test runner with no framework, no bundler and no dependency.
 */

/**
 * The index a recovered canonical recording is played at. A turn's segment
 * indices are 0..n-1, so nothing it announces can collide with this, and no
 * streamed item matches it: a replay is not a sentence, and nothing highlights
 * for it.
 */
export const CANONICAL_RECOVERY_INDEX = -2;

export interface TurnAudioRecoveryOptions {
  /**
   * Play the turn's canonical recording at `url`. Called at most once per turn —
   * the recording is the whole answer, so a second play repeats it rather than
   * recovering it.
   */
  playCanonical: (url: string) => void;

  /**
   * Nothing of this turn's answer could be played. The candidate is listening to
   * a silence this turn caused, and this is the only chance to say so.
   */
  onUnplayable: () => void;
}

export interface TurnAudioRecovery {
  /**
   * A segment of this turn could not be played. The queue has already skipped it
   * and moved on; this decides whether the answer can still be heard.
   */
  segmentFailed(): void;

  /**
   * The turn's canonical recording is `url`, or nothing when the server produced
   * none. It arrives with `done`, which may be after the failure it answers.
   */
  canonicalKnown(url: string | null): void;

  /** The canonical recording could not be played either. */
  canonicalFailed(): void;
}

export function createTurnAudioRecovery(
  options: TurnAudioRecoveryOptions
): TurnAudioRecovery {
  let segmentDidFail = false;
  let canonicalUrl: string | null = null;
  let played = false;
  let reported = false;

  const reportUnplayable = () => {
    if (reported) return;
    reported = true;
    options.onUnplayable();
  };

  const tryRecover = () => {
    if (played) return;
    if (!segmentDidFail) return;
    // Not known yet. A failure mid-answer arrives before `done`, and the URL that
    // answers it arrives with `done` — so this is a wait, not a dead end.
    if (!canonicalUrl) return;

    played = true;
    options.playCanonical(canonicalUrl);
  };

  return {
    segmentFailed() {
      segmentDidFail = true;
      tryRecover();
    },

    canonicalKnown(url) {
      canonicalUrl = url;
      // A failure may have arrived before the URL that answers it, or after.
      tryRecover();
      // Something to recover from, and nothing to recover with.
      if (segmentDidFail && !url) reportUnplayable();
    },

    canonicalFailed() {
      // Only a recovery that was actually attempted can have failed. Anything
      // else is a caller error, and reporting it would blame a turn whose audio
      // was never asked for.
      if (!played) return;
      reportUnplayable();
    },
  };
}
