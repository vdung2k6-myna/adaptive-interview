/**
 * A stored session recording, obtained rather than addressed.
 *
 * The platform serves a recording at the path a session's messages carry —
 * `/audio/<session>/<message>.wav` — behind the same credential as every other API resource.
 * A media element cannot send one: `<audio src>` issues its own request and offers no way to
 * add a header, so the request goes out bare, is refused with a 401, and the player reports
 * `NotSupportedError`. That is what a past message's playback did on this client.
 *
 * So the bytes are fetched here, through the caller's own authenticated request, and the
 * element is handed an object URL instead of an address. **That fetch is a required
 * parameter and never a default**: a quiet fallback to the global `fetch` would send no
 * credential and produce exactly the 401 this module exists to prevent, silently — the same
 * failure, now invisible. `sentence-queue.ts` takes its fetch for the same reason.
 *
 * **Why a module rather than four lines in the player.** This repository's tests run over
 * `src/lib/**` and nothing else — there is no DOM to render a component into — so a fetch
 * made inside `AudioPlayer` is a fetch no test can reach. Everything in here is reachable
 * with the fetch stood in for, which is what gives the replayed-session requirement
 * something that fails when it is broken.
 */

/** The page's authenticated fetch, injected so a test needs no credential and no server. */
export type RecordingFetch = (url: string) => Promise<Response>;

/** What asking for a recording answered, as the player needs it. */
export type RecordingOutcome =
  | { ok: true; url: string }
  | { ok: false; detail: string };

export interface RecordingOptions {
  /** The platform's own origin, for a path that names one of its files — see `recordingUrl`. */
  origin: string;
  /**
   * The caller's authenticated fetch (`apiFetch`).
   *
   * **Not optional, and that is the point** — see this module's header. A caller has to
   * state which request carries its credential, because the wrong answer here is a 401
   * that looks like a missing file.
   */
  fetch: RecordingFetch;
}

/**
 * A recording's address, as the fetch needs it.
 *
 * The server answers a path on **itself** — `/audio/<session>/<message>.wav` — and this page is
 * served from somewhere else, so a bare path is not an equivalent address: it resolves against
 * the page, whose server holds no recordings and answers a refusal rather than a file. Giving
 * the path the platform's origin is what turns it into the request the platform answers.
 *
 * `apiFetch` adds the credential and does not change the origin, which is why this cannot live
 * there, and why a caller that skipped this step would get a 401 that reads exactly like a
 * rejected token.
 */
function recordingUrl(path: string, origin: string): string {
  return path.startsWith("/") ? `${origin}${path}` : path;
}

/**
 * Obtain a stored recording, and answer with something the player can play.
 *
 * Never throws and never rejects. Everything that can go wrong comes back as a `detail`
 * naming it, for the caller to report: a refusal, a server that cannot be reached, and a
 * body the server did not send as audio. The player's own sentence to the person is
 * unchanged either way — it already says the audio is unavailable — so this is the
 * diagnosis, not the copy.
 *
 * **The caller owns the object URL.** Nothing here can know when playback is over, so
 * releasing it is the caller's — an object URL pins its bytes until it is revoked.
 */
export async function obtainRecording(
  path: string,
  options: RecordingOptions
): Promise<RecordingOutcome> {
  const doFetch = options.fetch;

  try {
    const res = await doFetch(recordingUrl(path, options.origin));

    if (!res.ok) {
      return { ok: false, detail: `the recording could not be read (HTTP ${res.status})` };
    }

    // The server says what it is sending; where it says something that is not audio, this is
    // a body that would fail in the decoder anyway — an error page from a proxy, say. Where
    // it says nothing at all, the decoder is left to decide rather than the absence of a
    // header being read as a refusal.
    const type = res.headers.get("content-type");
    if (type !== null && !type.startsWith("audio/")) {
      return { ok: false, detail: `the recording is not audio (${type})` };
    }

    return { ok: true, url: URL.createObjectURL(await res.blob()) };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "the recording could not be read",
    };
  }
}
