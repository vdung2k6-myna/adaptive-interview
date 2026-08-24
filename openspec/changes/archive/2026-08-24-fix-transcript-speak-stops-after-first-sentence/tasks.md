# Tasks: Fix Transcript Speak Stops After First Sentence

- [x] Explore codebase and reproduce the bug.
- [x] Write OpenSpec proposal, design, and tasks.
- [x] Apply fix in `src/app/interview/[id]/transcript/page.tsx`.
  - [x] Add `speakStreamDoneRef`.
  - [x] Guard `SentenceAudioQueue.onFinished` with `speakStreamDoneRef.current`.
  - [x] Handle `event: done` by setting `speakStreamDoneRef.current = true` and checking queue state.
  - [x] Reset `speakStreamDoneRef.current` in `cleanupStreamState()` and at the top of `speakMessageStream`.
- [x] Run `npm run build` in the frontend repo.
- [x] Run `npm run lint` in the frontend repo (passed; only pre-existing warnings/errors in unrelated files).
- [x] Manual verification:
  - [x] Backend `/api/voice/speak-stream` returns all sentence chunks for the bug text.
  - [x] Transcript page loads without server/runtime errors.
  - [ ] Browser click-through: bug text plays all sentences (requires manual UI interaction).
  - [ ] Browser click-through: short single-sentence message plays.
  - [ ] Browser click-through: Stop button works mid-stream.
  - [ ] Browser click-through: switching messages while playing works.
- [x] Update `docs/CHANGELOG.md` with bug fix entry.
- [x] Archive OpenSpec change.
