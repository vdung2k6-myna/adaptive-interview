# Tasks: fix-voice-tts-markdown-leak

- [x] Explore `stripMarkdown` in `adaptive-interview-api/src/lib/audio/text-processing.ts` and identify unhandled Markdown constructs.
- [x] Update `stripMarkdown` to remove links, images, strikethrough, and horizontal rules.
- [x] Reorder regexes so horizontal-rule lines (`---`, `***`, `___`) are removed before inline formatting can partially consume them.
- [x] Add/update unit tests for the new stripping behavior, including literal escaped newlines and CRLF line endings after fenced-code language tags.
- [x] Run `npm test` in the API repo and confirm all tests pass.
- [x] Run `npm run build` in the API repo and confirm no errors.
- [x] Run `npm run lint` in the API repo and confirm only pre-existing warnings.
- [x] Update `adaptive-interview-api/docs/API.md` to list the newly stripped Markdown constructs.
- [x] Update `adaptive-interview/docs/CHANGELOG.md` with a new entry for this fix.
- [ ] Manual regression test: start a voice interview and verify no Markdown formatting characters are spoken.
