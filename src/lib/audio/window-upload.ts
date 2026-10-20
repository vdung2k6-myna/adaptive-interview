/**
 * Sending one window of a recording while the answer is still being spoken.
 *
 * The recorder converts each window into the form the capture is sent in and hands it here; the
 * platform transcribes it on arrival and holds it under the turn's id. When the person stops, the
 * turn request names that id and carries no audio — the recording is assembled on the server from
 * the same windows, so the answer crosses the wire once.
 *
 * **Why the fetch is injected.** This repository's tests run over `src/lib/**` and nothing else, so
 * a `fetch` made here has to be one a test can stand in for. It is also, as `session-recording.ts`
 * says for its own fetch, the caller's authenticated request: the API answers every `/api` route
 * behind a Bearer, and a quiet fallback to the global `fetch` would send none and be refused.
 */

export interface WindowUploadOptions {
  /**
   * The platform's origin, when the caller needs one.
   *
   * Omitted, the request goes to `/api/voice/window` on **this page's own origin** and the app's
   * existing rewrite forwards it to the API server-side. That is the right default: it is the path
   * every other API call on the page already takes, it needs no CORS (the browser never crosses
   * an origin), and — the case this was written for — a page served from `localhost` does not
   * need a working route to the public internet just to reach the API beside it.
   */
  backendUrl?: string;
  /** The caller's authenticated fetch (`apiFetch`). */
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** The id the turn will be submitted under. */
  turnId: string;
  /** The session, for the browser route; absent for the agent's stateless turns. */
  sessionId?: string;
  /**
   * The language to transcribe in.
   *
   * Carried per window because the transcriber cannot detect it reliably on a short window: a
   * Vietnamese phrase comes back as Chinese without it (see the API's `resolveSttLanguage`).
   */
  language?: "english" | "vietnamese";
}

/**
 * A sender for one turn's windows.
 *
 * Windows must arrive in the order they were spoken, and this is used that way: the caller awaits
 * each send before converting the next window. A refused window throws rather than being skipped —
 * a gap is not a shorter answer, and the platform will refuse the turn that names a turn id with a
 * failed window rather than answer around it.
 */
/** Long enough to let a momentary refusal or a dropped connection clear, short
 *  enough that a person pressing stop does not wait on it twice. */
const RETRY_DELAY_MS = 400;

export function createWindowUploader(
  options: WindowUploadOptions
): (window: Blob) => Promise<void> {
  const origin = (options.backendUrl ?? "").replace(/\/$/, "");
  const endpoint = `${origin}/api/voice/window`;
  let nextIndex = 0;

  const send = async (index: number, window: Blob) => {
    const form = new FormData();
    form.append("audio", window, "window.wav");
    form.append("turnId", options.turnId);
    // The window's place in the turn. The server takes a repeated index once, so
    // this is what makes the retry below safe: a request whose answer was lost is
    // the same window, not a second one added to the answer.
    form.append("index", String(index));
    if (options.sessionId) form.append("sessionId", options.sessionId);
    if (options.language) form.append("language", options.language);

    const response = await options.fetch(endpoint, { method: "POST", body: form });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `A window could not be sent (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
      );
    }
  };

  return async (window: Blob) => {
    const index = nextIndex++;

    try {
      await send(index, window);
    } catch {
      // One retry, with the same index. The two failures worth surviving are a
      // network drop and a one-off transcription refusal, and both answer to
      // asking again — the index is what keeps the second ask from counting twice.
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      await send(index, window);
    }
  };
}
