/**
 * Whether this build classifies speech before the level gate decides.
 *
 * On by default: a deployment that never sets the variable gets the safer end-of-turn
 * decision, which is the reason the change exists. Off is stated explicitly, as the
 * literal `false`, so there is no accidental third state — the same shape
 * `windowed-ingest.ts` uses, inverted because this one ships on.
 *
 * `NEXT_PUBLIC_` because the recorder runs in the browser: the value is inlined when
 * the client is built, so backing out means a rebuild, not a restart.
 */

export function vadEnabled(value: string | undefined): boolean {
  return value !== "false";
}

export const VAD_ENABLED = vadEnabled(process.env.NEXT_PUBLIC_VAD_ENABLED);
