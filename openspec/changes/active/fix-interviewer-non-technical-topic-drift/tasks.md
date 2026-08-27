# Tasks: fix-interviewer-non-technical-topic-drift

- [x] Add technical-first instruction to the system prompt in `adaptive-interview-api/src/lib/prompts.ts`
- [x] Ensure wording still allows natural behavioral follow-ups
- [x] Run `npm run build` in `adaptive-interview-api`
- [x] Run `npm run lint` in `adaptive-interview-api` (only pre-existing warnings)
- [ ] Manual test: first 3–4 turns of a technical interview stay technical
- [ ] Manual test: behavioral questions appear as follow-ups or late turns
- [x] Review `adaptive-interview-api/src/lib/embeddings.ts` coverage weights; no tuning needed for this change (prompt-only fix)
- [x] Update `docs/OLLAMA.md` if prompt rules are documented there
- [x] Update `docs/CHANGELOG.md`
