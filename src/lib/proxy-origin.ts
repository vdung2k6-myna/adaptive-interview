/**
 * Refuse a proxy target that is the app itself.
 *
 * `NEXT_PUBLIC_BACKEND_URL` is inlined at build time. A value naming the app's
 * own origin is not a request to a different service: the catch-all route calls
 * itself through the public ingress, recursing until the edge proxy times out.
 * In practice that surfaced as a Cloudflare 524 after ~100 seconds, naming
 * neither the proxy nor the variable. These helpers make the same
 * misconfiguration a fast, legible 502 instead.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function effectivePort(url: URL): string {
  if (url.port) return url.port;
  return url.protocol === "https:" ? "443" : "80";
}

/**
 * The part of an origin two requests must share to reach the same listener:
 * host and port. Scheme is deliberately ignored because TLS may terminate in
 * front of the app, and every loopback spelling is treated as one host.
 *
 * Returns null when the value is not a URL, so a malformed backend address is
 * left for the forward attempt to report rather than refused as a loop.
 */
export function targetKey(origin: string): string | null {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (!url.hostname) return null;
  const host = LOOPBACK_HOSTS.has(url.hostname.toLowerCase())
    ? "loopback"
    : url.hostname.toLowerCase();
  return `${host}:${effectivePort(url)}`;
}

/** Whether forwarding to `backendUrl` would send the request back to this app. */
export function isSelfTarget(
  backendUrl: string,
  requestOrigins: readonly string[]
): boolean {
  const target = targetKey(backendUrl);
  if (!target) return false;
  return requestOrigins.some((origin) => targetKey(origin) === target);
}

/**
 * The origin the client actually used, as a tunnel or reverse proxy reports it.
 * `request.nextUrl.origin` is often the internal origin (`http://localhost:3000`)
 * behind a tunnel, so the public spelling has to come from the forwarded headers.
 *
 * Returns null when neither a host nor a forwarded host is present; the caller
 * then falls back to the request's own origin.
 */
export function requestOriginFromHeaders(
  headers: Headers,
  fallbackProtocol = "http"
): string | null {
  const first = (value: string | null): string | null =>
    value?.split(",")[0]?.trim() || null;
  const host =
    first(headers.get("x-forwarded-host")) ?? first(headers.get("host"));
  if (!host) return null;
  const protocol =
    first(headers.get("x-forwarded-proto")) ??
    fallbackProtocol.replace(/:$/, "");
  return `${protocol}://${host}`;
}
