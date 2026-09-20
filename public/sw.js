/**
 * Adaptive Interview Engine — Minimal Service Worker
 *
 * Caching strategy:
 * - Static Next.js build assets (`/_next/static/*`): cache-first, immutable.
 * - HTML navigation requests: network-first with offline fallback.
 * - API calls (`/api/*`): bypassed — this worker never caches them, and relaying
 *   them would bound a streamed response's lifetime by the worker's.
 * - Range requests: bypassed — the Cache API cannot store 206 Partial Content.
 * - Audio files (`/audio/*`) and everything else: network-first.
 *
 * A fetch this worker can neither serve from cache nor complete over the network
 * fails as a network error (`Response.error()`), never as a synthesized HTTP
 * status, so a worker-side failure stays distinguishable from a real one.
 *
 * The cache version above is stamped at build time by scripts/postbuild.mjs with
 * the identity of the build that produced it, naming each deployment's caches
 * after that build. The build fails when nothing has stamped it, so an unstamped
 * worker cannot ship and a browser cannot be left holding an old one.
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

  // Bypass API calls. Handling them buys nothing — this worker never caches
  // them — and respondWith() would put the worker in the path of a streamed
  // response whose lifetime must not be bounded by the worker's.
  if (API_PATTERN.test(url.pathname)) {
    return;
  }

  // Bypass range requests — the Cache API cannot store 206 Partial Content responses.
  // Browsers send Range headers for media (audio, video) and some fonts.
  if (request.headers.has("range")) {
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
            if (response.status === 200) {
              const clone = response.clone();
              caches
                .open(ASSET_CACHE)
                .then((cache) => cache.put(request, clone))
                .catch(() => {});
            }
            return response;
          })
          .catch(() => Response.error());
      })
    );
    return;
  }

  // Navigation requests (HTML pages): network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches
              .open(SHELL_CACHE)
              .then((cache) => cache.put(request, clone))
              .catch(() => {});
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
        if (response.status === 200) {
          const clone = response.clone();
          caches
            .open(ASSET_CACHE)
            .then((cache) => cache.put(request, clone))
            .catch(() => {});
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || Response.error();
        });
      })
  );
});
