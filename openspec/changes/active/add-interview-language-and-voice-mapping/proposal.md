# Proposal: Add Interview Language and Engine Voice Mapping

## Problem

Currently every interview defaults to English with no explicit language control. The LLM sometimes drifts into another language (especially when a candidate answers in Vietnamese during a technical interview), and the TTS voice is whatever the Audio Gateway default happens to be. Recruiters need a reliable way to run interviews in English or Vietnamese end-to-end.

## Solution

Add an explicit `language` field to every interview session with two supported values: `"english"` and `"vietnamese"`. Default to `"english"`.

This language drives three things:

1. **LLM interviews** — the system prompt instructs the model to conduct the interview in the configured language only.
2. **TTS voice selection** — each `(engine, language)` pair maps to a specific voice ID in the backend configuration.
3. **Evaluation feedback** — the evaluation prompt is also instructed to produce `strengths`, `weaknesses`, and recommendation text in the configured language.

The transcript page's **Speak** replay follows the same language and voice as the original session.

## Scope

In scope:
- Backend schema: add `language` column to `interview_sessions`.
- Backend `POST /api/sessions`: accept `language` from frontend.
- Backend `src/lib/prompts.ts`: inject language rule into interviewer and evaluator system prompts.
- Backend `src/lib/config/*.ts` and `src/lib/audio/client.ts`: map `(engine, language)` → voice ID for Kokoro and Piper.
- Backend voice routes (`/voice/start`, `/voice/turn`, `/voice/stream`, `/voice/speak`, `/voice/speak-stream`): pass the mapped voice ID to TTS.
- Frontend `src/app/setup/SetupForm.tsx`: add language selector and send `language` on session creation.
- Frontend transcript page: use session language for replay (already receives `ttsProvider`; voice mapping lives in backend).
- Documentation: `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/SETUP.md`, `docs/CHANGELOG.md`.

Out of scope:
- UI language / i18n of the dashboard itself.
- Allowing the candidate to override the interview language.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing sessions have no `language` value | Migration needed | Add `DEFAULT 'english'` in schema; existing rows adopt English automatically. |
| Wrong voice ID for Kokoro | TTS fails | Gateways usually validate voice IDs; fallback to default if unknown. |
| LLM still drifts | Candidate experience degraded | Strong system prompt rule + post-processing check on response before storing. |
| Evaluation language mismatch | Recruiter sees mixed-language feedback | Inject same language rule into evaluator prompt. |

## Success Criteria

- [ ] New sessions can be created with `language: "vietnamese"` or `language: "english"`.
- [ ] Default language is English when not specified.
- [ ] Interviewer questions, explanations, and replies are generated in the configured language.
- [ ] TTS uses a language-appropriate voice for the chosen engine and language.
- [ ] Evaluation `strengths`/`weaknesses`/recommendation text is in the configured language.
- [ ] Transcript Speak replay uses the session's language and voice.
- [ ] Build and lint pass in both repositories.
