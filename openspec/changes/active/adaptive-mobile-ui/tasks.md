# Tasks: Make Web UI Mobile Adaptive

## Navigation

- [ ] Create `src/components/MobileNav.tsx` hamburger menu component
- [ ] Update `src/app/layout.tsx` to use `MobileNav` on small screens while keeping desktop links

## Admin List Pages — Table → Card List

- [x] Update `src/app/dashboard/page.tsx`: mobile cards, responsive filters, desktop table unchanged
- [x] Update `src/app/positions/page.tsx`: mobile cards, desktop table unchanged
- [x] Update `src/app/candidates/page.tsx`: mobile cards, desktop table unchanged
- [x] Update `src/app/campaigns/page.tsx`: mobile cards, desktop table unchanged
- [x] Update `src/app/campaigns/[id]/page.tsx`: card lists for top candidates and positions on mobile
- [x] Update `src/app/compare/page.tsx`: stacked candidate cards on mobile, desktop table unchanged

## Interview Pages

- [x] Update `src/app/interview/[id]/page.tsx`: reduce mobile padding, larger input + send button, `text-base` input to prevent iOS zoom
- [x] Update `src/app/interview/[id]/voice/page.tsx`: stacked header on mobile, larger playback controls and recorder target
- [x] Update `src/app/interview/[id]/transcript/page.tsx`: larger Speak/Stop and playback-rate touch targets

## Forms / Setup

- [x] Update `src/app/setup/page.tsx` and `SetupForm.tsx`: responsive padding, `text-base` inputs, larger buttons
- [x] Update `src/app/positions/new/PositionForm.tsx` and candidate/campaign forms: `text-base` inputs and responsive padding

## Documentation

- [x] Update `docs/COMPONENTS.md` with `MobileNav` and responsive page notes
- [x] Update `docs/CHANGELOG.md` with mobile adaptive UI entry

## Validation

- [x] `npm run build` passes
- [x] `npm run lint` passes or only shows pre-existing issues
- [ ] No horizontal overflow at 375px viewport on any updated page
- [ ] Mobile nav opens/closes correctly
- [ ] Dashboard and admin pages render cards on mobile and tables on desktop
- [ ] Chat input does not trigger iOS auto-zoom
- [ ] Voice interview header and controls are usable at 375px
- [ ] Transcript Speak/Stop touch targets are at least 44×44px
- [ ] Dark mode works on mobile
