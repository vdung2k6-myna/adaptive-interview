/**
 * How long an answer is expected to be, and where a given one stands against it.
 *
 * The interviewer asks for an answer of about a minute or two. That is a range rather than a limit,
 * and a person speaking has no way to hold it in mind — so the recorder shows the clock it already
 * counts against it. What that display needs is one answer: which of three things is true right now.
 *
 * **Why the rule is here and not in the component.** This repository's tests reach `src/lib/**` and
 * nothing else, so two comparisons written into the recorder would be two numbers no test holds —
 * and the failure they invite is quiet: change one mark, leave the other, and the display keeps
 * working while describing a range nobody chose. Here the marks are named once and the boundaries
 * are asserted.
 *
 * Nothing in here ends a recording or limits one. The expectation is a guide shown to a person, and
 * the decision to keep speaking stays theirs — see the `answer-pacing` capability.
 */

/** The lower mark of "a minute or two". */
export const EXPECTED_FROM_MS = 60_000;

/** The upper mark of "a minute or two". */
export const EXPECTED_UNTIL_MS = 120_000;

/**
 * Where an answer stands against the length that was asked for.
 *
 * Three states rather than two, because the display has three different things to say: nothing in
 * particular while an answer is still shorter than the ask, that it is now the length that was asked
 * for, and that it has run past it.
 */
export type AnswerPace =
  /** Shorter than a minute: less than what the interviewer asked for. */
  | "short"
  /** A minute or more and up to two: the length that was asked for. */
  | "expected"
  /** Past two minutes: longer than what was asked for. */
  | "long";

/**
 * Where an answer of this length stands.
 *
 * Both marks belong to the state they open: exactly a minute is already the expected length, and
 * exactly two minutes is still it.
 */
export function paceOf(elapsedMs: number): AnswerPace {
  // A time that cannot be read is treated as no time elapsed. The recorder's own clock never
  // produces one, and the one answer that must not be given is telling somebody they have spoken
  // too long on the strength of a number that was never about them.
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "short";

  if (elapsedMs < EXPECTED_FROM_MS) return "short";
  if (elapsedMs <= EXPECTED_UNTIL_MS) return "expected";
  return "long";
}
