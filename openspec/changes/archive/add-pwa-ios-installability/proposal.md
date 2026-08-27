# Add PWA Support for iOS Installability

## Problem

The Android PWA change (`add-pwa-android-installability`) explicitly scoped iOS out. iPhone and iPad users who open an interview link in Safari currently get a browser-tab experience:

- Safari address bar and tab chrome consume screen space during interviews.
- If a user manually adds the site to the Home Screen via the Share sheet, the icon exists but the app still opens inside Safari.
- There is no launch splash screen, so the app briefly flashes white before rendering.
- iOS-specific viewport behavior (notch area, auto-zoom on small inputs) is not optimized for standalone mode.

Recruiters reviewing candidates and candidates taking voice interviews both benefit from a focused, chromeless launch on iOS.

## Solution

Add the minimal iOS PWA metadata and assets needed for Safari to launch the app in standalone mode with a branded splash screen:

1. Add `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, and `apple-mobile-web-app-title` meta tags.
2. Ensure `apple-touch-icon.png` is linked and regenerated if the brand mark changes.
3. Generate a core set of `apple-touch-startup-image` splash screens for common iPhone and iPad portrait sizes.
4. Update the viewport meta to `viewport-fit=cover` so the app renders edge-to-edge on notched devices in standalone mode.
5. Verify service worker registration works on iOS and that the offline fallback page renders correctly.
6. Update documentation and perform manual iOS testing, especially for voice interview microphone permission in standalone mode.

## Scope (In)

- `src/app/layout.tsx`: add iOS-specific PWA meta tags and splash screen links.
- `public/apple-touch-icon.png`: verify and regenerate if needed.
- `public/apple-touch-startup-image-*.png`: generate core splash screen set.
- `scripts/generate-pwa-icons.mjs`: extend to generate iOS splash screens and startup images.
- `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`, `docs/SETUP.md` updates for iOS PWA requirements.
- Manual iOS validation on a real device or simulator for standalone launch, text interview, and voice interview.

## Scope (Out)

- Push notifications (iOS Web Push requires more setup and is not needed).
- App Store distribution, Capacitor, Cordova, or TestFlight.
- iOS "Add to Home Screen" UI hint/banner (manual Share-sheet flow only for now).
- Changes to the Android manifest, service worker strategy, or icon set.
- Background sync or offline interview submission (same constraint as Android PWA).
- Comprehensive splash screen set covering every historical iOS device.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Voice microphone permission behaves differently or fails in iOS standalone mode | High | Test voice interview on a real iPhone; document fallback to Safari if iOS standalone blocks mic |
| `viewport-fit=cover` causes content to render under the notch/Dynamic Island | Medium | Use safe-area insets (`env(safe-area-inset-*)`) for top padding in the mobile UI |
| Splash screen aspect ratios mismatch new devices | Low | Core set covers current iPhone/iPad portrait sizes; accept minor letterboxing on older devices |
| iOS caches the old icon/splash after changes | Medium | Use versioned filenames or cache-busting query strings; test in private browsing |
| Service worker update cycle differs from Android | Low | `skipWaiting`/`clients.claim` already implemented; verify on iOS |

## Success Criteria

1. Safari on iOS offers "Add to Home Screen" from the Share sheet.
2. Launching from the Home Screen opens the app without Safari address bar.
3. Launch shows a branded splash screen instead of a white flash.
4. Text interview works end-to-end in standalone mode.
5. Voice interview can request and use the microphone in standalone mode.
6. No horizontal overflow or notch overlap on a modern iPhone in portrait standalone mode.
7. `npm run build` and `npm run lint` pass with no new errors.
8. `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`, and `docs/SETUP.md` are updated.
