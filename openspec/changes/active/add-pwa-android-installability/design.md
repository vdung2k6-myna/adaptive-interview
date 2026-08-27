# Design: Add PWA Support for Android Installability

## Overview

This change adds Progressive Web App (PWA) support to the Next.js frontend so that Android users can install the Adaptive Interview Engine to their home screen and launch it in a standalone, app-like window.

The backend remains unchanged. The PWA only affects how the frontend is packaged and presented by the browser.

## Architecture

```
┌─────────────────────────────────────────────┐
│           Android Device                      │
│  ┌─────────────────────────────────────┐    │
│  │  Chrome / WebAPK Launcher             │    │
│  │  - Install prompt                     │    │
│  │  - Home screen icon                   │    │
│  │  - Standalone window (no address bar) │    │
│  └─────────────┬───────────────────────┘    │
│                │                             │
│                ▼                             │
│  ┌─────────────────────────────────────┐    │
│  │  Next.js Frontend (PWA shell)       │    │
│  │  ┌─────────┐  ┌─────────────────┐   │    │
│  │  │ manifest│  │ Service Worker  │   │    │
│  │  │ .json   │  │ sw.js           │   │    │
│  │  └────┬────┘  └────────┬────────┘   │    │
│  │       │                │            │    │
│  │       ▼                ▼            │    │
│  │  App metadata      Cache shell,     │    │
│  │  + icons           network-first    │    │
│  │                     for API/audio   │    │
│  └─────────────────────────────────────┘    │
│                │                             │
│                ▼                             │
│  ┌─────────────────────────────────────┐    │
│  │  Express Backend (adaptive-         │    │
│  │  interview-api) over HTTPS           │    │
│  │  /api/*, /audio/*                   │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Files Added

| File | Purpose |
|---|---|
| `public/manifest.json` | Web App Manifest — names, colors, icons, start URL, display mode |
| `public/icon-192.png` | Launcher icon, 192×192 |
| `public/icon-512.png` | Launcher icon, 512×512 |
| `public/icon-maskable.png` | Maskable adaptive icon, 512×512 with safe zone |
| `public/apple-touch-icon.png` | iOS home screen icon ( opportunistic ) |
| `public/sw.js` | Service worker — precache shell, network-first for dynamic content |
| `public/offline.html` | Fallback HTML shell when offline |
| `src/app/offline/page.tsx` | In-app offline page (optional route fallback) |

## Files Modified

| File | Change |
|---|---|
| `src/app/layout.tsx` | Add manifest link, theme-color meta, apple-touch-icon, and service worker registration |
| `docs/SETUP.md` | Document PWA requirements and icon generation |
| `docs/ARCHITECTURE.md` | Add PWA/service worker section |
| `docs/CHANGELOG.md` | Add entry for this change |

## Manifest Design

```json
{
  "name": "Adaptive Interview Engine",
  "short_name": "Interviews",
  "description": "AI-powered adaptive technical interviews",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#171717",
  "orientation": "portrait",
  "scope": "/",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icon-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### Field rationale

- **`short_name: "Interviews"`** — short enough to fit under an Android launcher icon.
- **`start_url: "/dashboard"`** — recruiters land on the dashboard; candidates usually arrive via direct interview link. Direct links still work because `scope: "/"` covers all routes.
- **`display: "standalone"`** — removes browser chrome for an app-like experience.
- **`orientation: "portrait"`** — natural for chat and voice interview UIs; voice recorder controls are already stacked vertically.

## Service Worker Design

We will ship a **custom, minimal service worker** rather than adding a dependency like `next-pwa`. This aligns with the project's minimal-dependency philosophy and keeps the caching policy explicit.

### Caching strategy

| Request type | Strategy | Rationale |
|---|---|---|
| Static build assets (`/_next/static/*`) | Cache-first, immutable | Hashed filenames; safe to cache forever |
| HTML shell (`/`) | Network-first with offline fallback | Always try to serve the latest app shell |
| API calls (`/api/*`) | Network-only | Must never serve stale interview data or evaluation results |
| Audio files (`/audio/*`) | Network-first | Audio is generated per session; cache only as a performance side effect |
| External assets | Network-only | Avoid cross-origin caching complexity |

### Precached shell

At install time the service worker precaches:

- `/`
- `/offline.html`
- `/manifest.json`
- A small set of core route HTML pages? **No.** Precaching every Next.js static HTML route is fragile and version-specific. Instead, we cache the root shell and rely on Next.js client-side navigation to render routes. If a route is requested directly while offline, the service worker returns `/offline.html`.

### Cache versioning

```js
const CACHE_VERSION = "__BUILD_ID__";
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
```

The literal `__BUILD_ID__` is replaced at build time by `scripts/postbuild.mjs` with the current build id (from Next.js or a timestamp). This prevents stale shells from surviving across deployments.

### Skip waiting

The service worker calls `self.skipWaiting()` in the `install` event and claims clients in `activate`. This ensures updates take effect on the next page load rather than waiting for all tabs to close.

## Layout Updates

The root layout is a Server Component by default. Service worker registration must run in the browser, so we will add a small client-side registration script inside `layout.tsx` using a `<script>` block with `dangerouslySetInnerHTML`.

Because the script content is static and self-contained, this is acceptable. We avoid adding a new client component just for registration.

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/sw.js').catch(function(err) {
            console.error('SW registration failed:', err);
          });
        });
      }
    `,
  }}
/>
```

Additional meta tags:

```tsx
<meta name="theme-color" content="#171717" />
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

## Standalone Output Compatibility

The project uses `output: "standalone"` in `next.config.ts`. Files in `public/` are automatically copied to `.next/standalone/public/` during the build. We will verify that:

- `public/sw.js` is served at `http(s)://<host>/sw.js`
- `public/manifest.json` is served at `/manifest.json`
- Icons are served at their declared paths

If Next.js does not copy `public/` as expected (unlikely but possible with custom output paths), we will add a copy step to `scripts/postbuild.mjs`.

## Voice Interview Considerations

Voice interviews use `MediaRecorder`, `AudioContext`, and playback of audio files. In `standalone` mode on Android:

- Microphone permission is requested per-origin and should persist across launches.
- Audio playback should remain under user-gesture control, which the voice page already implements by creating `AudioContext` inside click/record handlers.
- We will test specifically that the first question autoplay and sentence-level streaming still work after install.

If `standalone` causes permission friction, the manifest's `display` can be downgraded to `minimal-ui` as a fallback. This decision will be made after real-device testing.

## Offline Fallback

When the user launches the PWA without connectivity:

1. The service worker intercepts the navigation request.
2. Network fails.
3. Service worker returns `offline.html` from cache.
4. `offline.html` shows a simple message: "No internet connection. Please reconnect to continue your interview."

Dynamic Next.js routes do not have an offline fallback; attempting to navigate to `/interview/abc` while offline will also return `offline.html`.

## Security

- Service worker scope is limited to `/` (same-origin).
- No cross-origin caching.
- No interception of `/api/*` beyond pass-through network.
- No sensitive tokens are cached.

## Dependencies

No new runtime dependencies. Optional dev dependency for icon generation if we automate it (e.g., `sharp` is already commonly available; check before adding).

## Manual Validation Plan

1. Deploy to an HTTPS staging environment.
2. Open in Chrome on Android.
3. Confirm Chrome menu offers "Add to Home Screen".
4. Confirm the install prompt shows the correct icon and short name.
5. Launch from home screen — verify no address bar.
6. Complete a text interview end-to-end.
7. Complete a voice interview end-to-end, including mic permission.
8. Enable airplane mode and relaunch — verify offline fallback page.
9. Run Chrome DevTools Lighthouse PWA audit and confirm installable.
