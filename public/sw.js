/**
 * Adaptive Interview Engine — Minimal Service Worker
 *
 * Caching strategy:
 * - Static Next.js build assets (`/_next/static/*`): cache-first, immutable.
 * - HTML navigation requests: network-first with offline fallback.
 * - API calls (`/api/*`): network-only.
 * - Audio files (`/audio/*`): network-first.
 * - Everything else: network-first.
 *
 * The literal __BUILD_ID__ is replaced at build time so each deployment
 * gets a fresh cache name and old service workers are replaced quickly.
 */

const CACHE_VERSION = "__BUILD_ID__";
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const ASSET_CACHE = `assets-${CACHE_VERSION}`;

const SHELL_URLS = ["/", "/offline.html", "/manifest.json"];

const IMMUTABLE_ASSET_PATTERN = /\/_next\/static\//;
const API_PATTERN = /^\/api\//;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.error("[SW] Install failed:", err);
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .catch((err) => {
        console.error("[SW] Activate cleanup failed:", err);
      })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass non-GET requests and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // API calls must always hit the network
  if (API_PATTERN.test(url.pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  // Immutable Next.js build assets — cache first
  if (IMMUTABLE_ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached || new Response("Asset unavailable", { status: 503 }));
      })
    );
    return;
  }

  // Navigation requests (HTML pages): network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) {
              return cached;
            }
            return caches.match("/offline.html").then((offline) => {
              return (
                offline ||
                new Response(
                  "<!doctype html><html><body style='font-family:sans-serif;padding:2rem;text-align:center;'><h1>Offline</h1><p>You are offline. Please reconnect to continue.</p></body></html>",
                  {
                    headers: { "Content-Type": "text/html" },
                  }
                )
              );
            });
          });
        })
    );
    return;
  }

  // Audio and everything else: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(ASSET_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || new Response("Network error", { status: 503 });
        });
      })
  );
});
