# Design: Add PWA Support for iOS Installability

## Overview

This change extends the existing PWA support to iOS Safari so that iPhone and iPad users can add the Adaptive Interview Engine to their Home Screen and launch it in a standalone, chromeless window with a branded splash screen.

It does not replace or duplicate the Android PWA work; it layers iOS-specific metadata and assets on top of the existing manifest and service worker.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              iOS Device                             │
│  ┌─────────────────────────────────────────────┐    │
│  │  Safari / Home Screen Web App               │    │
│  │  - Share sheet "Add to Home Screen"         │    │
│  │  - Standalone launch (no address bar)       │    │
│  │  - Branded splash screen                    │    │
│  └─────────────┬───────────────────────────────┘    │
│                │                                     │
│                ▼                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  Next.js Frontend (PWA shell)               │    │
│  │  ┌─────────────┐  ┌─────────────────────┐   │    │
│  │  │ iOS meta    │  │ Service Worker      │   │    │
│  │  │ tags +      │  │ sw.js               │   │    │
│  │  │ splash imgs │  │ (shared with        │   │    │
│  │  └─────┬───────┘  │  Android PWA)        │   │    │
│  │        │          └─────────────────────┘   │    │
│  │        ▼                                       │    │
│  │  apple-mobile-web-app-capable                 │    │
│  │  apple-touch-startup-image                    │    │
│  │  viewport-fit=cover                           │    │
│  └─────────────────────────────────────────────┘    │
│                │                                     │
│                ▼                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  Express Backend (adaptive-interview-api)   │    │
│  │  over HTTPS — /api/*, /audio/*              │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## Files Added or Modified

### Added

| File | Purpose |
|---|---|
| `public/apple-touch-startup-image-1170x2532.png` | iPhone 12/13/14/15/16 portrait splash screen |
| `public/apple-touch-startup-image-1290x2796.png` | iPhone 14 Pro Max / 15 Plus / 16 Plus portrait |
| `public/apple-touch-startup-image-1668x2388.png` | 11" iPad Pro / Air portrait splash screen |
| `public/apple-touch-startup-image-2048x2732.png` | 12.9" iPad Pro portrait splash screen |

### Modified

| File | Change |
|---|---|
| `src/app/layout.tsx` | Add iOS meta tags, splash screen links, and update viewport |
| `public/apple-touch-icon.png` | Regenerate if brand mark changes |
| `scripts/generate-pwa-icons.mjs` | Add splash screen generation for the core sizes above |
| `docs/ARCHITECTURE.md` | Add iOS PWA section |
| `docs/CHANGELOG.md` | Add entry for iOS PWA support |
| `docs/SETUP.md` | Document iOS PWA testing and asset generation |

## Layout Meta Tag Changes

Current `src/app/layout.tsx` already includes:

```tsx
<meta name="theme-color" content="#171717" />
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

Add iOS-specific tags:

```tsx
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Interviews" />
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover"
/>
<link
  rel="apple-touch-startup-image"
  href="/apple-touch-startup-image-1170x2532.png"
  media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
/>
<link
  rel="apple-touch-startup-image"
  href="/apple-touch-startup-image-1290x2796.png"
  media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
/>
<link
  rel="apple-touch-startup-image"
  href="/apple-touch-startup-image-1668x2388.png"
  media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
/>
<link
  rel="apple-touch-startup-image"
  href="/apple-touch-startup-image-2048x2732.png"
  media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
/>
```

### Field rationale

- **`apple-mobile-web-app-capable: yes`** — Required for Safari to launch in standalone mode.
- **`apple-mobile-web-app-status-bar-style: black-translucent`** — Makes the status bar overlay the app content with a dark background, matching the dark theme. We will verify it does not hide the nav bar.
- **`apple-mobile-web-app-title: Interviews`** — Short label under the Home Screen icon.
- **`viewport-fit=cover`** — Allows content to extend into the notch area. The existing mobile nav and page padding must respect `env(safe-area-inset-*)`.

## Splash Screen Design

The splash screen is a full-screen PNG showing the brand mark centered on a dark background matching `theme-color` (`#171717`).

Safe-area rule: keep the logo within the central 80% region vertically to avoid the Dynamic Island and Home indicator. The generator will center the icon and add padding proportional to screen height.

### Core sizes

| Size | Device | Device Width × Height (CSS px) | Scale |
|---|---|---|---|
| 1170×2532 | iPhone 12/13/14/15/16 | 390×844 | 3× |
| 1290×2796 | iPhone 14 Pro Max / 15 Plus / 16 Plus / 16 Pro Max | 430×932 | 3× |
| 1668×2388 | 11" iPad Pro / Air | 834×1194 | 2× |
| 2048×2732 | 12.9" iPad Pro | 1024×1366 | 2× |

These four sizes cover the majority of active iOS devices. Older devices without an exact match will use the closest image or fall back to a white launch background, which is acceptable.

## Generator Script Extension

`scripts/generate-pwa-icons.mjs` already draws the brand icon with Node's built-in zlib PNG encoder. We will add a `createSplashScreen(width, height)` function that:

1. Fills the canvas with the brand background color (`#18181b`).
2. Centers a larger version of the speech-bubble glyph.
3. Leaves top/bottom padding for the notch and Home indicator.
4. Outputs PNG files to `public/`.

No new dependencies are introduced.

## Viewport and Safe Area Considerations

`viewport-fit=cover` means the viewport extends to the physical edges of the screen. The existing layout uses a top `nav` bar. We must ensure the nav bar is not hidden under the status bar or Dynamic Island:

```css
/* globals.css or Tailwind arbitrary value */
padding-top: env(safe-area-inset-top);
```

In Tailwind, this can be expressed as `pt-[env(safe-area-inset-top)]` on the `<body>` or nav wrapper. The active `adaptive-mobile-ui` change already reduces page padding on small screens, so we will coordinate to add safe-area padding there if needed.

## Service Worker on iOS

The existing `public/sw.js` uses `skipWaiting` and `clients.claim`, which iOS Safari supports. The cache strategies remain the same:

- `/_next/static/*` — cache-first
- Navigation requests — network-first with offline fallback
- `/api/*` — network-only
- `/audio/*` — network-first

One iOS-specific note: Safari private browsing can disable service workers. The app will still work, but offline fallback may not. This is acceptable.

## Voice Interview Considerations

The biggest unknown is microphone behavior in iOS standalone mode (`apple-mobile-web-app-capable`). Historical iOS versions had quirks with `getUserMedia` permission persistence in standalone Web Apps. The active `fix-audio-streaming-stop-regressions` change is improving the audio pipeline, so we will validate voice interviews after that change lands.

If microphone permission fails or does not persist in standalone mode, the fallback is to direct the user to complete the interview in Safari. We will document this in `docs/SETUP.md` and `docs/SECURITY.md` if it becomes a real issue.

## Offline Fallback

The existing `public/offline.html` and `/offline` route serve as the offline fallback. On iOS, the service worker returns `offline.html` when the network fails. The page already includes a Retry button.

## Security

- No new cross-origin requests.
- No sensitive data cached beyond static assets and the offline shell.
- iOS meta tags contain no secrets.

## Dependencies

No new runtime or build dependencies. The existing `scripts/generate-pwa-icons.mjs` is extended with pure Node.js code.

## Manual Validation Plan

1. Run `npm run build` and verify `public/apple-touch-startup-image-*.png` are copied to `.next/standalone/public/`.
2. Deploy to an HTTPS staging environment.
3. Open in Safari on iPhone (iOS 16+) and iPad.
4. Tap Share → Add to Home Screen.
5. Close Safari and launch from Home Screen.
6. Verify no Safari address bar.
7. Verify splash screen appears before the app renders.
8. Complete a text interview end-to-end.
9. Complete a voice interview end-to-end, including microphone permission.
10. Enable airplane mode and relaunch — verify offline fallback page.
11. Test both light and dark mode rendering in standalone.
