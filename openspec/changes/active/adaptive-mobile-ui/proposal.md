# Make Web UI Mobile Adaptive

## Problem

The frontend is usable on desktop but has several mobile friction points:

- The top navigation bar shows all links in a single horizontal row, which wraps awkwardly or runs off-screen on narrow phones.
- Admin list pages (Dashboard, Positions, Candidates, Campaigns, Compare, Campaign detail) use wide HTML tables that overflow horizontally and become hard to read on small screens.
- Touch targets are too small in candidate-facing UI: the transcript Speak/Stop button, dashboard action links, and voice interview header controls are all text-sized.
- Page padding is `p-6` everywhere, consuming ~48px of horizontal space on a 375px device.
- Form inputs and the chat input use `text-sm` (14px). iOS Safari auto-zooms when focusing inputs below 16px, breaking the interview flow.
- The voice interview page still exposes small toggles and selects in the header, which will wrap badly on narrow screens.

## Solution

Make the UI adapt to narrow viewports using Tailwind responsive utilities and small layout adjustments:

1. Replace the top nav with a mobile-friendly layout: collapse links into a hamburger menu on small screens while keeping desktop navigation intact.
2. Convert admin tables to card lists below the `md` breakpoint, keeping desktop tables.
3. Increase touch targets across candidate-facing controls: Speak/Stop, playback rate selector, voice recorder, chat send button.
4. Reduce horizontal padding on small screens (`px-4 sm:px-6` / `p-4 md:p-6`) to reclaim content width.
5. Bump input font size to at least `text-base` (16px) so iOS does not auto-zoom.
6. Reorganize the voice interview header into a stacked, touch-friendly mobile layout.

## Scope (In)

- `src/app/layout.tsx` — responsive navigation (mobile hamburger menu)
- `src/app/dashboard/page.tsx` — card list on mobile, table on `md+`
- `src/app/positions/page.tsx` — card list on mobile
- `src/app/candidates/page.tsx` — card list on mobile
- `src/app/campaigns/page.tsx` — card list on mobile
- `src/app/campaigns/[id]/page.tsx` — responsive metric cards and card lists for tables
- `src/app/compare/page.tsx` — stacked comparison cards on mobile
- `src/app/interview/[id]/page.tsx` — larger input/button, reduced padding, no iOS zoom
- `src/app/interview/[id]/voice/page.tsx` — mobile header layout, larger recorder touch target
- `src/app/interview/[id]/transcript/page.tsx` — larger Speak/Stop touch targets and playback selector
- `src/app/setup/page.tsx` and form components — reduced padding, larger inputs
- `docs/COMPONENTS.md` and `docs/CHANGELOG.md` updates

## Scope (Out)

- Full redesign of desktop layouts (we keep current desktop experience)
- New CSS framework or custom breakpoints (use Tailwind defaults)
- PWA-specific UI changes (those live in `add-pwa-android-installability`)
- Bottom-sheet menus or complex mobile-only interactions beyond a simple hamburger

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Tailwind dark-mode responsive classes get verbose | Low | Keep changes consistent with existing `dark:` patterns; avoid one-off custom CSS |
| Card list on mobile loses sortability/scannability | Medium | Preserve status badges, scores, and clear actions; keep desktop table unchanged |
| Larger inputs increase vertical space | Low | Acceptable trade-off for usability; forms are already vertical |
| Hamburger menu requires client-side state in layout | Low | Add minimal `useState` with a small client-only menu component, keeping layout mostly server-rendered |

## Success Criteria

1. No horizontal overflow on any page at 375px viewport width.
2. Navigation is usable on a 375px screen without links wrapping off-screen.
3. Dashboard and admin list pages render as readable cards on mobile and tables on desktop.
4. Tap targets for Speak/Stop, voice recorder, and chat send are at least 44×44 CSS pixels.
5. Focusing the chat input or any form input on iOS does not trigger auto-zoom.
6. `npm run build` and `npm run lint` pass (or only show pre-existing issues).
7. `docs/COMPONENTS.md` and `docs/CHANGELOG.md` are updated.
