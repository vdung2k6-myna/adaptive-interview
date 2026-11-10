/**
 * API client wrapper for browser fetch calls.
 *
 * All requests are routed through a server-side proxy to avoid exposing
 * the API authentication token to the browser's network tab.
 */

/**
 * Wrapper around `fetch` that routes requests through the server-side proxy.
 * @param url Request URL (can be relative or absolute).
 * @param init Standard RequestInit options.
 * @returns fetch Response.
 */
export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  if (url.startsWith('/proxy')) {
    return fetch(url, { ...init });
  }

  let proxyUrl = url;

  if (url.startsWith('http')) {
    const urlObj = new URL(url);
    const path = urlObj.pathname.startsWith('/api')
      ? urlObj.pathname
      : `/api${urlObj.pathname}`;
    proxyUrl = `${path}${urlObj.search}`;
  } else {
    // Ensure the path starts with a slash for the proxy
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    proxyUrl = `${normalizedUrl}`;
  }

  return fetch(proxyUrl, { ...init });
}
