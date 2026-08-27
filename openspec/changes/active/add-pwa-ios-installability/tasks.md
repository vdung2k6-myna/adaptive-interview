# Tasks: Add PWA Support for iOS Installability

## Design & Planning

- [x] Identify iOS PWA gaps vs. existing Android PWA implementation
- [x] Decide splash screen scope (core 4-size set)
- [x] Confirm status-bar style and viewport-fit approach
- [x] Finalize `apple-mobile-web-app-title` — decision: "Interviews" to match Android `short_name`

## Assets

- [x] Verify `public/apple-touch-icon.png` is 180×180 and matches current brand mark
- [x] Regenerate `public/apple-touch-icon.png` via generator
- [x] Generate `public/apple-touch-startup-image-1170x2532.png`
- [x] Generate `public/apple-touch-startup-image-1290x2796.png`
- [x] Generate `public/apple-touch-startup-image-1668x2388.png`
- [x] Generate `public/apple-touch-startup-image-2048x2732.png`

## Generator Script

- [x] Extend `scripts/generate-pwa-icons.mjs` with `createSplashScreen(width, height)`
- [x] Add splash screen output paths to the generator's main function
- [x] Run generator and verify all PNGs are valid
- [x] Add `pwa:assets` npm script and document it in `docs/SETUP.md`

## Layout & Meta Tags

- [x] Add `apple-mobile-web-app-capable` meta tag to `src/app/layout.tsx`
- [x] Add `apple-mobile-web-app-status-bar-style` meta tag
- [x] Add `apple-mobile-web-app-title` meta tag
- [x] Update viewport meta to include `viewport-fit=cover`
- [x] Add four `apple-touch-startup-image` link tags with correct media queries
- [x] Verify `apple-touch-icon` link is still correct

## Safe Area / Mobile UI Coordination

- [x] Check whether `adaptive-mobile-ui` already handles `env(safe-area-inset-top)` — not present in current working tree, so added here
- [x] Add top safe-area padding to the root layout nav bar with `0.75rem` fallback for non-standalone browsers
- [ ] Verify no notch/Dynamic Island overlap on modern iPhones

## Service Worker / Offline

- [x] `public/sw.js` registration code unchanged and compatible with iOS Safari
- [x] `public/offline.html` fallback already exists and is copied by postbuild
- [x] Confirmed `output: "standalone"` copies new splash images to `.next/standalone/public/`

## Documentation

- [x] Update `docs/ARCHITECTURE.md` with iOS PWA section
- [x] Update `docs/SETUP.md` with iOS PWA asset generation and testing notes
- [x] Update `docs/CHANGELOG.md` with iOS PWA entry
- [x] Create `docs/PWA-INSTALL.md` end-user install guide for Android and iOS
- [x] Add `docs/PWA-INSTALL.md` to `docs/README.md` quick links
- [x] Update `docs/OPENSPEC.md` active changes table to include `add-pwa-ios-installability`

## Build & Lint

- [x] `npm run build` passes with no new errors
- [x] `npm run lint` passes with no new errors introduced (2 pre-existing errors in `scripts/test-coverage.js`, 6 pre-existing warnings)
- [x] All new PNG files are present in `.next/standalone/public/`

## Manual iOS Validation

- [ ] iPhone: Share sheet offers "Add to Home Screen"
- [ ] iPhone: Launch from Home Screen opens without Safari address bar
- [ ] iPhone: Splash screen displays on launch
- [ ] iPhone: Text interview works end-to-end in standalone mode
- [ ] iPhone: Voice interview microphone permission works in standalone mode
- [ ] iPhone: Offline fallback page shown when launched without connectivity
- [ ] iPad: Same validation in portrait orientation
- [ ] Light and dark mode both render correctly in standalone mode
