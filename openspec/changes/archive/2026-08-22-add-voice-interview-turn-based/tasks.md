# Tasks: Voice Interview (Turn-Based)

## Prerequisites
- [x] Read `CLAUDE.md` and confirm no conflicts with existing conventions
- [x] Verify audio.cpp HTTP API endpoints (`/v1/audio/transcriptions`, `/v1/audio/speech`)
- [x] Confirm text interview page (`/interview/[id]/page.tsx`) will remain untouched

## Phase 1: Database & Config
- [x] Add `mode` column to `interview_sessions` schema (`text` | `voice`, default `text`)
- [x] Add audio columns to `messages` schema (`audioUrl`, `audioDurationSeconds`, `audioFormat`, `sttConfidence`)
- [x] Generate and run Drizzle migration
- [x] Add `audio` config block to `src/lib/config/index.ts` (`baseUrl`, `sttModel`, `ttsModel`, `timeoutMs`)
- [x] Add audio defaults to `src/lib/config/development.ts`
- [x] Add audio defaults to `src/lib/config/production.ts`
- [x] Add `AUDIOCPP_*` env vars to `.env.local` and document in `docs/SETUP.md`

## Phase 2: Audio Infrastructure
- [x] Create `src/lib/audio/client.ts` — HTTP client for audio.cpp
- [x] Create `src/lib/audio/stt.ts` — wrapper around `/v1/audio/transcriptions`
- [x] Create `src/lib/audio/tts.ts` — wrapper around `/v1/audio/speech`
- [x] Create `src/lib/audio/storage.ts` — save/load audio blobs to local filesystem
- [x] Add health check for audio.cpp at app startup (log warning if unreachable)

## Phase 3: API Route
- [x] Create `src/app/api/voice/turn/route.ts`
- [x] Implement multipart parser for `sessionId` + `audio` blob
- [x] Validate session exists, mode === `voice`, status !== `completed`
- [x] Save incoming audio blob to `/tmp/audio/{sessionId}/`
- [x] Call STT → get transcription
- [x] Store candidate message with transcription + audio metadata
- [x] Build prompt and call Ollama (reuse existing `buildPrompt` + `generateChatResponse`)
- [x] Handle final turn: mark session completed, return completion message
- [x] Call TTS with LLM response text → get audio buffer
- [x] Save response audio to `/tmp/audio/{sessionId}/`
- [x] Store interviewer message with text + audio metadata
- [x] Return JSON response shape per design.md
- [x] Add error handling for STT/TTS/LLM failures with appropriate status codes

## Phase 4: Frontend Components
- [x] Create `src/components/AudioRecorder.tsx`
  - [x] MediaRecorder API with `audio/webm` fallback to `audio/wav`
  - [x] Live waveform visualization (AudioContext + AnalyserNode)
  - [x] Record / Stop / Discard controls
  - [x] Emit `onRecordingComplete(blob, durationMs)`
- [x] Create `src/components/AudioPlayer.tsx`
  - [x] HTML5 audio element with custom controls
  - [x] Play / Pause / Seek / Volume
  - [x] Transcript show/hide toggle
  - [x] Accept `audioUrl` and `transcript` props
- [x] Create `src/app/interview/[id]/voice/page.tsx`
  - [x] Fetch session data, verify mode === `voice`
  - [x] Display position title, candidate name, turn counter
  - [x] Render AudioRecorder when it's candidate's turn
  - [x] Render AudioPlayer for interviewer messages
  - [x] Show "Processing..." states between turns
  - [x] Handle session completion (show completion screen)
  - [x] Graceful fallback if audio.cpp is unreachable

## Phase 5: Integration & Routing
- [x] Update session creation to support optional `mode` parameter (`text` | `voice`)
- [x] Ensure text interview page (`/interview/[id]`) redirects voice sessions
- [x] Ensure voice interview page (`/interview/[id]/voice`) errors on text sessions
- [x] Add link/button to start voice interview from dashboard or session creation flow

## Phase 6: Testing & Validation
- [x] Manual test: Record audio → submit → verify STT transcription accuracy
- [x] Manual test: Verify interviewer audio plays correctly
- [x] Manual test: Complete full voice interview (all turns)
- [x] Manual test: Verify text interviews still work (regression)
- [x] PII audit: Confirm no candidate names in audio filenames or URLs
- [x] Run `npm run build` — no errors
- [x] Run `npm run lint` — no new errors (remaining errors are pre-existing)
- [x] Test audio.cpp unreachable → graceful error message

## Phase 7: Documentation
- [x] Update `docs/API.md` — document voice endpoints
- [x] Update `docs/ARCHITECTURE.md` — add voice pipeline to architecture diagram
- [x] Update `docs/COMPONENTS.md` — add AudioRecorder and AudioPlayer
- [x] Update `docs/SETUP.md` — audio.cpp installation and env vars
- [x] Update `docs/CHANGELOG.md` — add entry for voice interview mode
- [x] Update `docs/SECURITY.md` — note voice data storage and privacy
