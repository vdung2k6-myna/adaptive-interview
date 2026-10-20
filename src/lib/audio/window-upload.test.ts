/**
 * The window upload suite. Run with Node's own runner:
 *
 *   node --test src/lib/audio/window-upload.test.ts
 *
 * What this pins is the request the API is given: the turn it belongs to, the session and language
 * it is transcribed under, and the window's own bytes. A refused window throws — the caller treats
 * that as the turn failing, because answering from the windows that did arrive would be answering
 * a different question.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createWindowUploader } from "./window-upload.ts";

interface Captured {
  url: string;
  init?: RequestInit;
}

function standingIn(status = 202): { calls: Captured[]; fetch: (url: string, init?: RequestInit) => Promise<Response> } {
  const calls: Captured[] = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(status === 202 ? '{"received":true}' : "refused", { status });
    },
  };
}

async function textOf(value: FormDataEntryValue | null): Promise<string | null> {
  if (typeof value === "string") return value;
  if (value instanceof File) return await value.text();
  return null;
}

describe("createWindowUploader", () => {
  it("posts each window to the platform's window endpoint", async () => {
    const stub = standingIn();
    const send = createWindowUploader({
      backendUrl: "http://localhost:4000/",
      fetch: stub.fetch,
      turnId: "turn-0001",
    });

    await send(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }));

    assert.equal(stub.calls.length, 1);
    assert.equal(
      stub.calls[0].url,
      "http://localhost:4000/api/voice/window",
      "one slash between the origin and the path, however the origin was written"
    );
    assert.equal(stub.calls[0].init?.method, "POST");
  });

  it("defaults to this page's own origin, so the app's rewrite carries it", async () => {
    const stub = standingIn();
    // The page is served from whatever host the person is using — localhost during a
    // local run, the deployment's domain otherwise. A relative path is the only
    // address that is right in both, and it needs no CORS.
    const send = createWindowUploader({ fetch: stub.fetch, turnId: "turn-0004" });

    await send(new Blob([new Uint8Array([1])]));

    assert.equal(stub.calls[0].url, "/api/voice/window");
  });

  it("carries the turn, the session, the language and the audio itself", async () => {
    const stub = standingIn();
    const send = createWindowUploader({
      backendUrl: "http://localhost:4000",
      fetch: stub.fetch,
      turnId: "turn-0001",
      sessionId: "session-0001",
      language: "vietnamese",
    });

    await send(new Blob([new Uint8Array([7, 8, 9])]));

    const form = stub.calls[0].init?.body;
    assert.ok(form instanceof FormData, "the request is multipart, as the route reads it");
    assert.equal(await textOf(form.get("turnId")), "turn-0001");
    assert.equal(await textOf(form.get("index")), "0", "a turn's first window is its index 0");
    assert.equal(await textOf(form.get("sessionId")), "session-0001");
    assert.equal(await textOf(form.get("language")), "vietnamese");

    const audio = form.get("audio");
    assert.ok(audio instanceof File, "the window is a file part");
    assert.equal(audio.name, "window.wav");
    assert.deepEqual([...new Uint8Array(await audio.arrayBuffer())], [7, 8, 9]);
  });

  it("leaves out a session and a language it was not given", async () => {
    const stub = standingIn();
    // The agent route has no session, and an absent language is the service's own detection
    // rather than an empty field.
    const send = createWindowUploader({
      backendUrl: "http://localhost:4000",
      fetch: stub.fetch,
      turnId: "turn-0002",
    });

    await send(new Blob([new Uint8Array([1])]));

    const form = stub.calls[0].init?.body as FormData;
    assert.equal(form.get("sessionId"), null);
    assert.equal(form.get("language"), null);
  });

  it("numbers a turn's windows in the order they are sent", async () => {
    const stub = standingIn();
    const send = createWindowUploader({ fetch: stub.fetch, turnId: "turn-0005" });

    await send(new Blob([new Uint8Array([1])]));
    await send(new Blob([new Uint8Array([2])]));
    await send(new Blob([new Uint8Array([3])]));

    assert.deepEqual(
      stub.calls.map((call) => (call.init?.body as FormData).get("index")),
      ["0", "1", "2"]
    );
  });

  it("retries a refused window once, under the same index", async () => {
    let attempt = 0;
    const calls: RequestInit[] = [];
    // The first answer is a refusal; the second is the platform accepting it. The
    // index is the same, so the server can tell this is one window, not two.
    const fetch = async (_url: string, init?: RequestInit) => {
      calls.push(init ?? {});
      attempt++;
      return new Response("", { status: attempt === 1 ? 502 : 202 });
    };
    const send = createWindowUploader({ fetch, turnId: "turn-0006" });

    await send(new Blob([new Uint8Array([1])]));

    assert.equal(calls.length, 2, "one retry, not a loop");
    assert.deepEqual(
      calls.map((call) => (call.body as FormData).get("index")),
      ["0", "0"],
      "the retry asks for the same window"
    );
  });

  it("throws when both the attempt and its retry are refused", async () => {
    const stub = standingIn(502);
    const send = createWindowUploader({
      backendUrl: "http://localhost:4000",
      fetch: stub.fetch,
      turnId: "turn-0003",
    });

    await assert.rejects(send(new Blob([new Uint8Array([1])])), /502/);
    assert.equal(stub.calls.length, 2, "the retry was made before giving up");
  });
});
