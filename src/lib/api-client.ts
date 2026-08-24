/**
 * API client wrapper for browser fetch calls.
 *
 * Automatically injects `Authorization: Bearer <token>` when
 * `NEXT_PUBLIC_API_TOKEN` is set.
 */

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || "";

/**
 * Wrapper around `fetch` that adds the Authorization header.
 * @param url Request URL (can be relative or absolute).
 * @param init Standard RequestInit options.
 * @returns fetch Response.
 */
export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (API_TOKEN) {
    headers.set("Authorization", `Bearer ${API_TOKEN}`);
  }
  return fetch(url, { ...init, headers });
}
