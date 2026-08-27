# Tasks: Add PWA Support for Android Installability

## Design & Planning

- [x] Finalize manifest fields (name, short_name, start_url, display, theme colors)
- [x] Decide service worker caching strategy and offline fallback behavior
- [x] Confirm icon design/source and required sizes

## Assets

- [x] Generate `public/icon-192.png` (192×192, brand mark)
- [x] Generate `public/icon-512.png` (512×512, brand mark)
- [x] Generate `public/icon-maskable.png` (512×512, maskable safe zone)
- [x] Generate `public/apple-touch-icon.png` (180×180)

## Manifest & Meta Tags

- [x] Create `public/manifest.json`
- [x] Update `src/app/layout.tsx` with `<link rel="manifest" />`, theme-color meta, and apple-touch-icon link
- [x] Confirm viewport meta tag is present and correct

## Service Worker

- [x] Create `public/sw.js` with shell precache, network-first API/audio strategy, and offline fallback
- [x] Add service worker registration in `src/app/layout.tsx` (client-only, guarded)
- [x] Create `public/offline.html` fallback shell
- [x] Create `src/app/offline/page.tsx` fallback route (optional, for in-app navigation fallback)

## Build & Deployment

- [x] Verify `public/sw.js` is served correctly in `npm run dev`
- [x] Verify `public/sw.js` is included in `output: "standalone"` build output
- [x] Verify icons and manifest are reachable in production build

## Documentation

- [x] Update `docs/SETUP.md` with PWA deployment notes (HTTPS requirement, icon generation)
- [x] Update `docs/ARCHITECTURE.md` with PWA/service worker section
- [x] Update `docs/CHANGELOG.md` with PWA entry

## Validation

- [x] `npm run build` passes with no errors
- [x] `npm run lint` passes (only pre-existing issues remain, none introduced by this change)
- [ ] Lighthouse PWA audit reaches installable threshold
- [ ] Manual Android test: Add to Home Screen prompt appears
- [ ] Manual Android test: Standalone launch opens without address bar
- [ ] Manual Android test: Text interview works end-to-end in standalone mode
- [ ] Manual Android test: Voice interview microphone permission works in standalone mode
- [ ] Manual Android test: Offline fallback page shown when launched without connectivity
