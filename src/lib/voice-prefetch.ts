/**
 * The client half of speculative retrieval (design.md D1, D6, D10).
 *
 * The page owns the debounce trigger, the topic list and the turn's request;
 * this module owns the two things that need to be reasoned about in one place —
 * the single in-flight prefetch and the single held id — and nothing else. It
 * takes its `fetch` and base URL as parameters and imports no values, so it runs
 * under Node's own test runner with no framework, no bundler and no dependency.
 */

/** The fetch this controller calls: the page's authenticated wrapper. */
export type PrefetchFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface VoicePrefetchOptions {
  /**
   * The authenticated fetch (`apiFetch`), so a prefetch carries the same
   * credentials as the turn it serves rather than being rejected by the API's
   * auth middleware.
   */
  fetch: PrefetchFetch;
  /** The backend origin, without the route path. */
  baseUrl: string;
  /** Quiet period after the last keystroke before a prefetch is issued. */
  debounceMs?: number;
}

export interface VoicePrefetchController {
  /**
   * Note that the input now reads `text`. A prefetch is issued once typing has
   * been quiet for `debounceMs`, and only when topics are enabled — with no
   * topics the backend has no scope to search, so the request would be a
   * guaranteed no-op.
   */
  schedule(text: string, topics: string[]): void;

  /**
   * The prefetch id a turn submitting `text` should carry, or nothing when no
   * prefetch is held for that exact input. A held prefetch serves one turn and is
   * consumed by this call: after it, the same id is not offered again.
   *
   * The backend is the authority on matching (D2) — it discards a hold whose
   * input differs and searches fresh — so this check is an optimization, not the
   * rule. It exists so a turn does not carry an id the backend will only discard.
   */
  turnFields(text: string): { prefetchId?: string };

  /** Abandon any in-flight prefetch and any that has not been issued yet. */
  cancel(): void;

  /** Prefetches issued and not yet settled. For tests and diagnostics. */
  inFlight(): number;
}

const DEFAULT_DEBOUNCE_MS = 250;
const PREFETCH_PATH = "/api/voice-agent/prefetch";

/**
 * Whether a change in the input warrants a prefetch at all — the single gate the
 * page routes every input state change through, so the answer lives with the
 * controller rather than being restated at each call site.
 *
 * A voice turn is excluded on purpose: its text does not exist until
 * transcription returns, so there is nothing to prefetch for it. So is a session
 * with no enabled topics, which gives the backend no scope to search — the
 * backend would decline that prefetch, and issuing it would be a request whose
 * only possible outcome is nothing held.
 */
export function shouldPrefetch(state: {
  mode: "voice" | "text";
  text: string;
  topics: string[];
}): boolean {
  return state.mode === "text" && state.text.trim().length > 0 && state.topics.length > 0;
}

export function createVoicePrefetch(options: VoicePrefetchOptions): VoicePrefetchController {
  const { fetch, baseUrl, debounceMs = DEFAULT_DEBOUNCE_MS } = options;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let request: AbortController | null = null;
  let outstanding = 0;
  let held: { text: string; id: string } | null = null;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function abortInFlight() {
    if (request) {
      request.abort();
      request = null;
    }
  }

  async function issue(text: string, topics: string[]) {
    const controller = new AbortController();
    request = controller;
    outstanding++;

    try {
      const response = await fetch(`${baseUrl}${PREFETCH_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, enabledTopics: topics }),
        signal: controller.signal,
      });

      // A non-ok response is not exceptional here: the backend answers a
      // prefetch it will not hold with `{ prefetchId: null }`, and an error means
      // the same thing to this controller — nothing to reuse.
      if (!response.ok) return;

      const payload = (await response.json()) as { prefetchId?: unknown };
      if (typeof payload.prefetchId === "string") {
        held = { text, id: payload.prefetchId };
      }
    } catch {
      // A prefetch is speculative. Aborting one is routine (the next keystroke
      // replaced it), and a failed one must change nothing: the turn it was meant
      // for searches exactly as it would with no prefetch at all (D5).
    } finally {
      outstanding--;
      // Only clear the slot if this is still the current request — a later
      // prefetch may have taken it, and clearing here would hide that one.
      if (request === controller) {
        request = null;
      }
    }
  }

  return {
    schedule(text, topics) {
      clearTimer();
      // The moment the input changes, the in-flight prefetch is for text that is
      // no longer being submitted, so it is aborted rather than left to compete
      // for doc-etl-api's single search lock (D6).
      abortInFlight();

      const trimmed = text.trim();
      if (!trimmed || !topics.length) return;

      timer = setTimeout(() => {
        timer = null;
        void issue(trimmed, topics);
      }, debounceMs);
    },

    turnFields(text) {
      if (!held || held.text !== text.trim()) return {};

      const { id } = held;
      held = null;
      return { prefetchId: id };
    },

    cancel() {
      clearTimer();
      abortInFlight();
    },

    inFlight() {
      return outstanding;
    },
  };
}
