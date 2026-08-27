# Tasks: fix-prompt-voice-rule-leaks-to-text-mode

- [x] Remove the Vietnamese number-spelling voice rule from `buildSystemPrompt` in `adaptive-interview-api/src/lib/prompts.ts`
- [x] Run `npm run build` in `adaptive-interview-api`
- [x] Run `npm run lint` in `adaptive-interview-api`
- [ ] Manual test: text interview shows Arabic numerals
- [ ] Manual test: voice interview + Kokoro still spells numbers in Vietnamese
- [ ] Manual test: voice interview + Piper keeps raw numerals
- [x] Update `docs/OLLAMA.md` if prompt content is documented there (no voice number rule present; no change needed)
- [x] Update `docs/CHANGELOG.md`
