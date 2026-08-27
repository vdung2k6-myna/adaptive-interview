# Tasks: fix-voice-first-question-autoplay

- [x] Identify why the first question does not auto-play in voice interview mode.
- [x] Update `VoiceInterviewPage` to create a `SentenceAudioQueue` inside the "Start Interview" click handler.
- [x] Return the first interviewer message from `startInterview()` and enqueue its audio URL when the API responds.
- [x] Remove the fragile `<audio>`-element-based autoplay `useEffect`.
- [x] Update `handleTurnFallback` to enqueue fallback turn audio into the same sentence queue.
- [x] Lint the changed file.
- [ ] Restart the frontend dev server and run `npm run build` to verify.
- [ ] Manual test: click "Start Interview" and confirm the first question auto-plays.
- [ ] Manual test: verify subsequent turns and fallback turns auto-play.
- [x] Update `docs/COMPONENTS.md` with the new first-question flow.
- [x] Update `docs/CHANGELOG.md` with an entry for this fix.
