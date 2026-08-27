# Add PWA Support for Android Installability

## Problem

Candidates increasingly open anonymous interview links on Android phones. Right now the app runs only as a browser tab:

- No home-screen icon or splash screen.
- Browser chrome (address bar, tabs) competes for space and attention during an interview.
- The experience feels like a website, not a focused interview app.
- Recruiters and admins who use the dashboard on phones also get the same bare-browser experience.

For a voice interview in particular, every pixel of vertical space and every reduction in friction matters. A Progressive Web App (PWA) lets Android users install the app, launch it from the app drawer, and use it in a standalone, chromeless window.

## Solution

Add the minimal PWA scaffolding required for Chrome on Android to offer "Add to Home Screen" and launch the app in `standalone` mode:

1. Web App Manifest (`public/manifest.json`) with name, icons, theme colors, start URL, and display mode.
2. App icons at the sizes Android expects (192px, 512px, maskable variant).
3. A lightweight service worker (`public/sw.js`) that precaches the static shell and serves a network-first strategy for everything else.
4. A small offline fallback page shown when the shell loads without connectivity.
5. Layout meta tags so the browser picks up the manifest and theme color on every route.
6. Manual validation on a real Android device for install prompt, standalone launch, and voice interview microphone permissions.

## Scope (In)

- Web App Manifest and icon set in `public/`.
- Service worker registered from the root layout.
- Theme-color and viewport meta updates in `src/app/layout.tsx`.
- Offline fallback page (`src/app/offline/page.tsx`).
- Documentation updates: `docs/SETUP.md`, `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`.
- Manual Android testing checklist for install, standalone launch, text interview, and voice interview.

## Scope (Out)

- Push notifications (no use case identified yet).
- Background sync or offline interview submission (the app still requires backend connectivity).
- iOS-specific native behavior beyond basic `apple-touch-icon` support.
- App-store distribution or Capacitor/Cordova wrapper.
- Wake Lock API (screen-keep-awake during voice) — noted as future enhancement, not included here.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Voice microphone permission behaves differently in standalone mode | High | Test on a real Android device; keep `minimal-ui` as a fallback display option if `standalone` causes permission regressions |
| `output: "standalone"` does not serve `public/sw.js` after build | Medium | Verify service worker URL in `.next/standalone` build output; adjust `next.config.ts` or copy step in `scripts/postbuild.mjs` if needed |
| Generated icons look bad when masked by Android | Low | Provide a maskable icon with proper safe-zone padding |
| Service worker caches stale shell after a deploy | Medium | Version cache name by build hash; implement skipWaiting in the service worker |
| HTTPS required for install prompt not available in local dev | Low | Test install prompt in a staging environment with HTTPS; local dev validates service worker registration only |

## Success Criteria

1. Chrome on Android shows the "Add to Home Screen" prompt (or menu item) for the deployed site.
2. Launching from the home screen opens the app without the browser address bar (`display: standalone`).
3. The app still functions correctly for text interviews after install.
4. Voice interviews can request and use the microphone in standalone mode.
5. An offline fallback page is shown when the shell is loaded without connectivity.
6. `npm run build` succeeds and the service worker is present in the standalone output.
7. `docs/SETUP.md`, `docs/ARCHITECTURE.md`, and `docs/CHANGELOG.md` are updated.
