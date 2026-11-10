/**
 * The proxy's self-forward guard. Run with Node's own runner:
 *
 *   node --test src/lib/proxy-origin.test.ts
 *
 * A `NEXT_PUBLIC_BACKEND_URL` naming the app's own origin used to turn every
 * proxied call into a recursive request through the public ingress. The only
 * symptom was an edge-proxy timeout after ~100 seconds, so what these tests
 * pin is that the same misconfiguration is recognised immediately.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isSelfTarget,
  requestOriginFromHeaders,
  targetKey,
} from "./proxy-origin.ts";

describe("targetKey", () => {
  it("treats loopback spellings on the same port as one host", () => {
    assert.equal(
      targetKey("http://localhost:3000"),
      targetKey("http://127.0.0.1:3000")
    );
  });

  it("keeps different ports apart", () => {
    assert.notEqual(
      targetKey("http://127.0.0.1:3000"),
      targetKey("http://127.0.0.1:4000")
    );
  });

  it("does not claim an unreadable value is an origin", () => {
    assert.equal(targetKey("not a url"), null);
  });
});

describe("isSelfTarget", () => {
  it("refuses the app's own public origin", () => {
    assert.equal(
      isSelfTarget("https://demo.example.com", ["https://demo.example.com"]),
      true
    );
  });

  it("refuses the app's own origin written as a loopback alias", () => {
    assert.equal(
      isSelfTarget("http://localhost:3000", ["http://127.0.0.1:3000"]),
      true
    );
  });

  it("allows a distinct backend origin", () => {
    assert.equal(
      isSelfTarget("http://127.0.0.1:4000", [
        "https://demo.example.com",
        "http://127.0.0.1:3000",
      ]),
      false
    );
  });

  it("leaves an unreadable backend address for the forward attempt", () => {
    assert.equal(isSelfTarget("not a url", ["http://127.0.0.1:3000"]), false);
  });
});

describe("requestOriginFromHeaders", () => {
  it("prefers the forwarded host and protocol", () => {
    const headers = new Headers();
    headers.set("host", "localhost:3000");
    headers.set("x-forwarded-host", "demo.example.com");
    headers.set("x-forwarded-proto", "https");

    assert.equal(
      requestOriginFromHeaders(headers),
      "https://demo.example.com"
    );
  });

  it("falls back to the host and the given protocol", () => {
    const headers = new Headers();
    headers.set("host", "127.0.0.1:3000");

    assert.equal(
      requestOriginFromHeaders(headers, "http:"),
      "http://127.0.0.1:3000"
    );
  });

  it("returns nothing without a host", () => {
    assert.equal(requestOriginFromHeaders(new Headers()), null);
  });
});
