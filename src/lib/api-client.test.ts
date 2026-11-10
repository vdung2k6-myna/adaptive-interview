/**
 * The browser fetch wrapper's URL routing. Run with Node's own runner:
 *
 *   node --test src/lib/api-client.test.ts
 *
 * What this pins is where a request goes, because that decides whether the
 * server-side route can add the credential: `/api` and `/audio` stay on this
 * origin, and an absolute URL is reduced to its path rather than to
 * `/api/audio/...`. A track under the old rule became a 404 even though the
 * backend served the file.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { apiFetch } from "./api-client.ts";

function captureFetch(): { urls: string[]; restore: () => void } {
  const urls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response(null, { status: 204 });
  }) as typeof globalThis.fetch;
  return {
    urls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

describe("apiFetch", () => {
  it("leaves an /api path on this origin for the API proxy", async () => {
    const stub = captureFetch();
    try {
      await apiFetch("/api/sessions");
    } finally {
      stub.restore();
    }
    assert.deepEqual(stub.urls, ["/api/sessions"]);
  });

  it("leaves an /audio path on this origin for the audio proxy", async () => {
    const stub = captureFetch();
    try {
      await apiFetch("/audio/music/track.mp3");
    } finally {
      stub.restore();
    }
    assert.deepEqual(stub.urls, ["/audio/music/track.mp3"]);
  });

  it("reduces an absolute API URL to its path", async () => {
    const stub = captureFetch();
    try {
      await apiFetch("http://127.0.0.1:4000/api/sessions?status=active");
    } finally {
      stub.restore();
    }
    assert.deepEqual(stub.urls, ["/api/sessions?status=active"]);
  });

  it("reduces an absolute audio URL to its path, not to /api/audio", async () => {
    const stub = captureFetch();
    try {
      await apiFetch("http://127.0.0.1:4000/audio/music/track.mp3");
    } finally {
      stub.restore();
    }
    assert.deepEqual(stub.urls, ["/audio/music/track.mp3"]);
  });
});
