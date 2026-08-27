# Tasks: fix-tts-code-block-whole-question

- [x] Update `stripMarkdown` in `adaptive-interview-api/src/lib/audio/text-processing.ts` to preserve fenced code-block content
- [x] Add/update tests in `adaptive-interview-api/src/lib/audio/text-processing.test.ts`
- [x] Run `npm run test` (or `npm test`) in `adaptive-interview-api` for the audio module
- [x] Update `AudioPlayer.tsx` in `adaptive-interview` to render interviewer transcript with `MarkdownRenderer`
- [x] Ensure candidate transcripts remain plain pre-wrapped text
- [x] Run `npm run build` in `adaptive-interview`
- [x] Run `npm run lint` in `adaptive-interview` (only pre-existing errors/warnings)
- [ ] Manual test: voice interview with a code-block question reads code content aloud
- [ ] Manual test: voice interview transcript renders code block visually
- [ ] Regression test: text interview Markdown rendering unchanged
- [x] Update `docs/COMPONENTS.md` if `AudioPlayer` is documented
- [x] Update `docs/CHANGELOG.md`
