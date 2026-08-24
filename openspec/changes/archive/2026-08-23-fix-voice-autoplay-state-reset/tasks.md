# Tasks: Fix Voice Interview Autoplay State Reset

- [x] Identify root cause in `voice/page.tsx` (missing `pendingChunksRef.clear()` and `nextExpectedIndexRef.current = 0`)
- [x] Add the two missing reset lines in `handleRecordingComplete`
- [x] Run `npx tsc --noEmit` to verify TypeScript compiles
- [x] Run `npm run build` — passed
- [x] Update CHANGELOG.md with bug fix entry
