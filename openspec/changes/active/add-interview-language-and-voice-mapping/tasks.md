# Tasks: Add Interview Language and Engine Voice Mapping

## Backend

- [x] Add `language` column to `interview_sessions` table in `src/lib/schema.ts` with default `"english"`.
- [x] Update `POST /api/sessions` in `src/routes/sessions.ts` to accept, validate, and store `language`.
- [x] Update `GET /api/sessions/:id` in `src/routes/sessions.ts` to return `language`.
- [x] Add `language` to `PromptSession` interface in `src/lib/prompts.ts`.
- [x] Update `buildSystemPrompt` to inject language rule and pass `language` from `buildPrompt`.
- [x] Update evaluation prompt in `src/lib/evaluation.ts` to inject language rule.
- [x] Add voice map to `AppConfig` in `src/lib/config/index.ts`.
- [x] Set English voice defaults in `src/lib/config/development.ts` and `src/lib/config/production.ts`:
  - Kokoro English: `af_heart`
  - Piper English: `en_US-lessac-medium`
  - Leave Vietnamese values empty by default so the services keep their current installed voices.
- [x] Add `resolveVoice(engine, language)` helper in audio lib (returns `undefined` for empty Vietnamese config so the service default is used).
- [x] Update all voice routes (`/start`, `/turn`, `/stream`, `/speak`, `/speak-stream`) in `src/routes/voice.ts` to pass resolved voice to TTS.
- [x] Add runtime engine fallback: English interviews forced to Piper when session is configured for Kokoro, because the deployed Kokoro model is Vietnamese-only.
- [x] Update text interview route (`src/routes/messages.ts`) to pass `language` to `buildPrompt`.
- [x] Update `SynthesizeOptions` / `synthesizeSpeechWithFallback` callers so voice is explicitly provided.
- [x] Fix `splitForTTS` trailing-fragment issue: merge final chunks shorter than 3 words or 15 chars into the previous chunk so TTS does not synthesize a single meaningless word.

## Frontend

- [x] Add language selector to `src/app/setup/SetupForm.tsx` and include `language` in session creation body.
- [x] Auto-select TTS engine when language changes: English → Piper, Vietnamese → Kokoro.
- [x] Add `language` to `SessionData` interface in `src/app/interview/[id]/page.tsx`.
- [x] Add `language` to `SessionData` interface in `src/app/interview/[id]/transcript/page.tsx`.
- [x] Pass `language` from `sessionData.session.language` to `speakMessageStream` and forward it to backend `/api/voice/speak-stream`.
- [x] Add `language` to `SessionData` interface in `src/app/interview/[id]/voice/page.tsx` (display/typing only; backend handles voice).

## Documentation

- [x] Update `adaptive-interview-api/docs/API.md` with `language` field for session and voice endpoints.
- [x] Update `adaptive-interview/docs/API.md` with streaming TTS note.
- [x] Update `adaptive-interview-api/docs/ARCHITECTURE.md` to describe language rule and voice mapping.
- [x] Update `adaptive-interview-api/docs/SETUP.md` with new environment variables.
- [x] Add dated entry to `adaptive-interview/docs/CHANGELOG.md`.

## Validation

- [x] `npm run build` passes in `adaptive-interview`.
- [x] `npm run build` passes in `adaptive-interview-api`.
- [x] `npm run lint` passes in `adaptive-interview` (only pre-existing errors/warnings unrelated to this change).
- [x] `npm run lint` passes in `adaptive-interview-api` (only pre-existing warnings unrelated to this change).
- [ ] Manual test: create English voice interview (Piper recommended until English Kokoro model is installed), verify questions in English and English voice.
- [ ] Manual test: create Vietnamese voice interview, verify questions stay in Vietnamese even if candidate answers in English and that the existing Vietnamese voice is unchanged.
- [ ] Manual test: transcript Speak replay respects session language.
- [ ] Manual test: evaluation strengths/weaknesses match session language.

## Pre-deployment English Voice Installation

- [x] Piper: English voice `en_US-norman-medium.onnx` + `.onnx.json` is installed in `pipervoices\norman\` and `PIPER_VOICE_ENGLISH=en_US-norman-medium` is set in `.env`.
- [ ] Kokoro: either extend `kokoro-service` with an English Kokoro model that includes `af_heart`, or document that English interviews should use Piper until an English Kokoro model is added.
