/**
 * The client's prefetch suite. Run with Node's own runner:
 *
 *   node --test src/lib/voice-prefetch.test.ts
 *
 * No vitest, no jest, no dependency — the module takes its `fetch` as a
 * parameter and imports only types, so this needs nothing installed (verified
 * 2026-09-20 on Node v22.22.2). Note the `.ts` extension in the import below:
 * Node resolves it directly, while the page imports the same module through the
 * `@/*` alias, which type stripping would not resolve.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createVoicePrefetch, shouldPrefetch, type PrefetchFetch } from "./voice-prefetch.ts";

const TOPICS = ["Truyện kiếm hiệp"];
const BASE = "http://localhost:4000";
/** Short enough to keep the suite fast, long enough to be a real debounce. */
const DEBOUNCE_MS = 5;

interface Recorded {
  url: string;
  method?: string;
  body: { text?: string; enabledTopics?: string[] };
  signal: AbortSignal;
}

/**
 * A stand-in for the prefetch endpoint. `manual` holds every request open until
 * `release()`, which is what lets a test observe one still in flight.
 */
function fakeBackend(options: { manual?: boolean; status?: number; prefetchId?: unknown } = {}) {
  const { manual = false, status = 200, prefetchId = "pf-1" } = options;
  const calls: Recorded[] = [];
  const waiters: Array<() => void> = [];

  const fetch: PrefetchFetch = async (url, init) => {
    calls.push({
      url,
      method: init.method,
      body: JSON.parse(String(init.body)) as Recorded["body"],
      signal: init.signal as AbortSignal,
    });
    if (manual) {
      // Hold the request open, and reject it on abort exactly as a real fetch
      // does — otherwise "one in flight" could not be asserted meaningfully.
      await new Promise<void>((resolve, reject) => {
        const signal = init.signal;
        const onAbort = () => reject(new DOMException("aborted", "AbortError"));
        if (signal?.aborted) {
          onAbort();
          return;
        }
        signal?.addEventListener("abort", onAbort, { once: true });
        waiters.push(() => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        });
      });
    }
    return new Response(JSON.stringify({ prefetchId }), { status });
  };

  return {
    calls,
    fetch,
    /** Let every held request settle. */
    release: () => waiters.splice(0).forEach((resolve) => resolve()),
  };
}

/** Wait past the debounce, plus room for the request and its handler to settle. */
const quiet = () => new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 6));

function controller(backend: ReturnType<typeof fakeBackend>) {
  return createVoicePrefetch({ fetch: backend.fetch, baseUrl: BASE, debounceMs: DEBOUNCE_MS });
}

describe("shouldPrefetch — when an input change is worth a prefetch", () => {
  it("is true for text in a text turn with topics enabled", () => {
    assert.equal(shouldPrefetch({ mode: "text", text: "kiem hiep", topics: TOPICS }), true);
  });

  it("is false for a voice turn, whose text does not exist yet", () => {
    assert.equal(shouldPrefetch({ mode: "voice", text: "kiem hiep", topics: TOPICS }), false);
  });

  it("is false with no topics enabled, since the backend would decline it", () => {
    assert.equal(shouldPrefetch({ mode: "text", text: "kiem hiep", topics: [] }), false);
  });

  it("is false for whitespace-only input", () => {
    assert.equal(shouldPrefetch({ mode: "text", text: "   ", topics: TOPICS }), false);
  });
});

describe("createVoicePrefetch — issuing", () => {
  it("issues one prefetch once typing has been quiet", async () => {
    const backend = fakeBackend();
    const prefetch = controller(backend);

    prefetch.schedule("k", TOPICS);
    prefetch.schedule("ki", TOPICS);
    prefetch.schedule("kiem", TOPICS);
    await quiet();

    assert.equal(backend.calls.length, 1, "a burst of keystrokes is one prefetch");
    assert.equal(backend.calls[0].body.text, "kiem");
    assert.deepEqual(backend.calls[0].body.enabledTopics, TOPICS);
    assert.equal(backend.calls[0].method, "POST");
    assert.equal(backend.calls[0].url, `${BASE}/api/voice-agent/prefetch`);
  });

  it("keeps one request in flight and aborts the one it replaces", async () => {
    const backend = fakeBackend({ manual: true });
    const prefetch = controller(backend);

    prefetch.schedule("kiem", TOPICS);
    await quiet();
    assert.equal(backend.calls.length, 1);
    assert.equal(prefetch.inFlight(), 1);

    prefetch.schedule("kiem hiep", TOPICS);
    await quiet();

    assert.equal(backend.calls.length, 2, "the new text is prefetched");
    assert.equal(backend.calls[0].signal.aborted, true, "the stale request is abandoned");
    assert.equal(backend.calls[1].signal.aborted, false, "the current request is not");
    assert.equal(prefetch.inFlight(), 1, "still only one in flight (D6)");
  });

  it("issues nothing without topics, and nothing for blank input", async () => {
    const backend = fakeBackend();
    const prefetch = controller(backend);

    prefetch.schedule("kiem hiep", []);
    prefetch.schedule("   ", TOPICS);
    await quiet();

    assert.equal(backend.calls.length, 0);
  });

  it("abandons a prefetch that has not been issued yet", async () => {
    const backend = fakeBackend();
    const prefetch = controller(backend);

    prefetch.schedule("kiem", TOPICS);
    prefetch.cancel();
    await quiet();

    assert.equal(backend.calls.length, 0);
    assert.equal(prefetch.inFlight(), 0);
  });

  it("abandons an in-flight prefetch on request", async () => {
    const backend = fakeBackend({ manual: true });
    const prefetch = controller(backend);

    prefetch.schedule("kiem", TOPICS);
    await quiet();
    prefetch.cancel();
    await quiet();

    assert.equal(backend.calls.length, 1);
    assert.equal(backend.calls[0].signal.aborted, true);
  });

  it("holds nothing when the backend answers with no id", async () => {
    for (const options of [
      { status: 200, prefetchId: null },
      { status: 500 },
      { status: 200, prefetchId: 42 },
    ]) {
      const backend = fakeBackend(options);
      const prefetch = controller(backend);

      prefetch.schedule("kiem", TOPICS);
      await quiet();

      assert.deepEqual(
        prefetch.turnFields("kiem"),
        {},
        `a ${JSON.stringify(options)} answer holds nothing for reuse`
      );
    }
  });

  it("survives a request that throws", async () => {
    const fetch = (() => Promise.reject(new Error("offline"))) as PrefetchFetch;
    const prefetch = createVoicePrefetch({ fetch, baseUrl: BASE, debounceMs: DEBOUNCE_MS });

    prefetch.schedule("kiem", TOPICS);
    await quiet();

    assert.deepEqual(prefetch.turnFields("kiem"), {});
    assert.equal(prefetch.inFlight(), 0);
  });
});

describe("createVoicePrefetch — carrying the id on a turn", () => {
  it("offers the held id to a turn submitting the text it was issued for", async () => {
    const backend = fakeBackend({ prefetchId: "pf-9" });
    const prefetch = controller(backend);

    prefetch.schedule("kiem hiep", TOPICS);
    await quiet();

    assert.deepEqual(prefetch.turnFields("kiem hiep"), { prefetchId: "pf-9" });
  });

  it("offers nothing when no prefetch was issued", () => {
    const backend = fakeBackend();
    const prefetch = controller(backend);

    assert.deepEqual(prefetch.turnFields("kiem hiep"), {});
  });

  it("offers the id once, so a second turn searches for itself", async () => {
    const backend = fakeBackend();
    const prefetch = controller(backend);

    prefetch.schedule("kiem", TOPICS);
    await quiet();

    assert.ok(prefetch.turnFields("kiem").prefetchId);
    assert.deepEqual(prefetch.turnFields("kiem"), {}, "a prefetch serves one turn");
  });

  it("offers nothing to a turn whose text differs, and keeps the hold", async () => {
    const backend = fakeBackend();
    const prefetch = controller(backend);

    prefetch.schedule("kiem", TOPICS);
    await quiet();

    assert.deepEqual(
      prefetch.turnFields("kiem hiep"),
      {},
      "a turn for other text must carry no id — the backend would only discard it"
    );
    assert.ok(
      prefetch.turnFields("kiem").prefetchId,
      "the hold still belongs to the text it was issued for"
    );
  });

  it("offers the newer id after the input changes", async () => {
    const backend = fakeBackend();
    const prefetch = controller(backend);

    prefetch.schedule("kiem", TOPICS);
    await quiet();
    prefetch.schedule("kiem hiep", TOPICS);
    await quiet();

    assert.equal(backend.calls.length, 2);
    assert.equal(backend.calls[1].body.text, "kiem hiep");
    assert.deepEqual(prefetch.turnFields("kiem"), {}, "the older hold was replaced");
    assert.deepEqual(prefetch.turnFields("kiem hiep"), { prefetchId: "pf-1" });
  });

  it("leaves no chunk behind for a later turn after editing without submitting", async () => {
    const backend = fakeBackend();
    const prefetch = controller(backend);

    // The user types, then keeps typing and submits something else. Nothing was
    // ever submitted for the first text, so no turn may carry its id.
    prefetch.schedule("kiem", TOPICS);
    await quiet();
    prefetch.schedule("kiem hiep la gi", TOPICS);
    await quiet();

    assert.deepEqual(
      prefetch.turnFields("kiem hiep la gi"),
      { prefetchId: "pf-1" },
      "the submitted text carries its own prefetch"
    );
    assert.deepEqual(prefetch.turnFields("kiem"), {}, "and the abandoned text carries nothing");
  });
});
