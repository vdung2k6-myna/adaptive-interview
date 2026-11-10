import { NextRequest, NextResponse } from "next/server";

import { isSelfTarget, requestOriginFromHeaders } from "@/lib/proxy-origin";

/**
 * The proxy behind both `/api/*` and `/audio/*`.
 *
 * One implementation, two mounts, because the backend puts the same credential
 * on both: `/api` and `/audio` are behind `apiAuthMiddleware` (see `app.ts` in
 * `adaptive-interview-api`). A Next rewrite cannot add that header, which is
 * why `/audio` used to 401 for a browser that could not send one — and why it
 * now goes through the same server-side injection as the API.
 */

export type ProxyPrefix = "api" | "audio";

/**
 * Request headers worth passing through. `range` and `if-range` keep a media
 * element's seek and resume working; the conditional headers let a repeat
 * request answer 304 instead of re-sending a multi-megabyte file.
 */
const FORWARDED_HEADERS = [
  "content-type",
  "accept",
  "user-agent",
  "range",
  "if-range",
  "if-none-match",
  "if-modified-since",
];

export async function proxyToBackend(
  request: NextRequest,
  pathSegments: string[],
  prefix: ProxyPrefix
): Promise<NextResponse> {
  // Use environment variable or fallback to the default backend URL.
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  const authToken = process.env.NEXT_PUBLIC_API_TOKEN;

  // A backend URL naming this app's own origin would make the proxy call
  // itself through the public ingress until the edge times out. Refuse it
  // immediately, naming the variable, instead of forwarding.
  const publicOrigin =
    requestOriginFromHeaders(request.headers, request.nextUrl.protocol) ??
    request.nextUrl.origin;
  if (isSelfTarget(backendUrl, [publicOrigin, request.nextUrl.origin])) {
    console.error(
      `[Proxy] refusing to forward ${request.nextUrl.pathname}: NEXT_PUBLIC_BACKEND_URL names this app's own origin`
    );
    return NextResponse.json(
      {
        error: "The API proxy is misconfigured.",
        detail:
          "NEXT_PUBLIC_BACKEND_URL names this application's origin. It must name the backend API's origin, for example http://127.0.0.1:4000. Correct it and rebuild: the value is inlined at build time.",
      },
      { status: 502 }
    );
  }

  // The catch-all segments are URL-decoded by Next; encode each on the way out
  // so a track whose name holds a space, `#` or `?` reaches the backend intact.
  const rawPath = pathSegments.map(encodeURIComponent).join("/");
  const cleanPath = rawPath.startsWith(`${prefix}/`) ? rawPath : `${prefix}/${rawPath}`;
  const targetUrl = `${backendUrl}/${cleanPath}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  // Inject the Bearer token server-side. It is the same credential the backend
  // checks on `/api` and on `/audio`.
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  try {
    const response = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? await request.blob() : undefined,
      // Audio files are large and the backend already controls its own caching;
      // Next's data cache must not hold a copy.
      cache: "no-store",
    });

    // Return the backend response as is: status, range headers and content type
    // are what a media element and the sentence queue both read.
    return new NextResponse(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error("Proxy Error:", error);
    return NextResponse.json(
      { error: "Failed to proxy request to backend API" },
      { status: 502 }
    );
  }
}
