/**
 * Whether a recording is sent as it is made, rather than whole when it stops.
 *
 * A configuration value rather than a constant because the client and the API have to agree on
 * the wire, and they are deployed separately: the API accepts both shapes, so this decides which
 * one this build uses. Off — the default — is exactly the behaviour the client had before windows
 * existed; on, each converted window goes to `/api/voice/window` and the turn names the id.
 *
 * `NEXT_PUBLIC_` because the recorder runs in the browser, where the value is inlined at build
 * time. It is read once here so the two pages and the recorder cannot disagree about it.
 */
export const WINDOWED_INGEST = process.env.NEXT_PUBLIC_WINDOWED_INGEST === "true";
