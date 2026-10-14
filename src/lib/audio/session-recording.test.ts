/**
 * The stored-recording suite. Run with Node's own runner:
 *
 *   node --test src/lib/audio/session-recording.test.ts
 *
 * The module exists because the request for a recording has to carry the credential, and the
 * only thing that can be said about "carries the credential" without a server is *which*
 * fetch was used. So the fetch is handed in, and one case stands a sentinel on the global one
 * to prove it is never reached — that is the regression this whole change is about, and a
 * suite that only checked the happy path would have passed against the breakage too.
 *
 * What this suite pins is that a recording which cannot be obtained comes back as a report
 * rather than as a player that cannot play, and that the address the module builds is one the
 * platform answers, with nothing appended to it.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { obtainRecording, type RecordingFetch } from "./session-recording.ts";

const ORIGIN = "https://demo.vdung2k6.com";
const PATH = "/audio/0894761b-76c7-4fed-8715-e8a7aa2090bc/08a0941b-2f3c-4a1e-9d77-interviewer.wav";

/** A recording, as the audio mount sends one: bytes, and the type the library decided. */
function recording(): Response {
  return new Response(new Uint8Array([82, 73, 70, 70]), {
    headers: { "Content-Type": "audio/wav" },
  });
}

/** The page's authenticated fetch, remembering what it was asked for. */
function recordingFetcher(answer: (sent: string) => Response | Promise<Response>) {
  const sent: string[] = [];
  const doFetch: RecordingFetch = async (url) => {
    sent.push(url);
    return answer(url);
  };
  return { doFetch, sent };
}

describe("obtaining a stored recording", () => {
  it("answers a recording the platform sent as something the player can play", async () => {
    const { doFetch } = recordingFetcher(() => recording());

    const outcome = await obtainRecording(PATH, { origin: ORIGIN, fetch: doFetch });

    assert.equal(outcome.ok, true, "a recording the server answered is a recording to play");
    if (!outcome.ok) return;
    assert.match(
      outcome.url,
      /^blob:/,
      "the element is handed an object URL, because an address is a request it cannot authenticate"
    );
    URL.revokeObjectURL(outcome.url);
  });

  it("answers a refusal as a report, and no URL", async () => {
    const { doFetch } = recordingFetcher(() => new Response("Unauthorized", { status: 401 }));

    const outcome = await obtainRecording(PATH, { origin: ORIGIN, fetch: doFetch });

    assert.equal(outcome.ok, false, "a refused recording is not something to play");
    if (outcome.ok) return;
    assert.match(outcome.detail, /HTTP 401/, "the report names the refusal that caused it");
    assert.ok(!("url" in outcome), "and carries no URL for a player to reach for");
  });

  it("reads the recording through the fetch it was handed, and through no other", async () => {
    // The breakage this guards: a module that quietly fell back to the global fetch would
    // send no credential, be refused, and report the recording as gone. Standing a sentinel
    // on the global is the only way to assert an absence.
    const realFetch = globalThis.fetch;
    let globalCalls = 0;
    globalThis.fetch = (async () => {
      globalCalls += 1;
      throw new Error("the global fetch was called, so no credential was sent");
    }) as typeof fetch;

    try {
      const { doFetch, sent } = recordingFetcher(() => recording());

      const outcome = await obtainRecording(PATH, { origin: ORIGIN, fetch: doFetch });

      assert.equal(outcome.ok, true, "the caller's fetch answered, so the recording plays");
      assert.equal(globalCalls, 0, "the credential-bearing fetch is the only one used");
      assert.deepEqual(
        sent,
        [`${ORIGIN}${PATH}`],
        "the path is given the platform's origin, and nothing is appended to it — no credential in a URL or a query string"
      );
      if (outcome.ok) URL.revokeObjectURL(outcome.url);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("answers a server it cannot reach as a report, rather than as an unhandled rejection", async () => {
    const outcome = await obtainRecording(PATH, {
      origin: ORIGIN,
      fetch: async () => {
        throw new Error("Network request failed");
      },
    });

    assert.equal(outcome.ok, false);
    if (outcome.ok) return;
    assert.match(outcome.detail, /Network request failed/);
  });

  it("answers a body the server did not send as audio as a report, rather than handing it to the player", async () => {
    const { doFetch } = recordingFetcher(
      () => new Response("<html>Not Found</html>", { headers: { "Content-Type": "text/html" } })
    );

    const outcome = await obtainRecording(PATH, { origin: ORIGIN, fetch: doFetch });

    assert.equal(outcome.ok, false, "an error page is not a recording, however it arrived");
    if (outcome.ok) return;
    assert.match(outcome.detail, /not audio/);
    assert.match(outcome.detail, /text\/html/, "the report names what arrived instead");
  });
});

/**
 * The origin rule. Separate from the cases above because it is a different question: those ask
 * what the module does with an answer, these ask what it asks for. A bare path is not an
 * equivalent way to name a recording — it resolves against the page — so what reaches the fetch
 * has to be the platform's own address.
 */
describe("addressing the platform's recording", () => {
  it("requests a recording at the platform's origin, not as the bare path the session carries", async () => {
    const { doFetch, sent } = recordingFetcher(() => recording());

    await obtainRecording(PATH, { origin: ORIGIN, fetch: doFetch });

    assert.equal(sent.length, 1, "one request, for the one recording asked for");
    assert.notEqual(sent[0], PATH, "the session's path on its own resolves against the page");
    assert.equal(
      sent[0],
      `${ORIGIN}${PATH}`,
      "and against the platform once its origin is in front of it"
    );
  });

  it("requests the same address the page would have resolved, where the two share an origin", async () => {
    // Where the page is served from the platform, a bare path resolved correctly before this
    // change and must keep resolving to the same thing: `new URL` is what the browser did with it.
    const { doFetch, sent } = recordingFetcher(() => recording());

    await obtainRecording(PATH, { origin: ORIGIN, fetch: doFetch });

    assert.equal(sent[0], new URL(PATH, ORIGIN).href, "the address is unchanged from before");
  });

  it("leaves an address that is already the platform's alone, rather than prefixing it twice", async () => {
    const { doFetch, sent } = recordingFetcher(() => recording());
    const absolute = `${ORIGIN}${PATH}`;

    await obtainRecording(absolute, { origin: ORIGIN, fetch: doFetch });

    assert.equal(sent[0], absolute, "an address that names the platform is not given it again");
  });
});
