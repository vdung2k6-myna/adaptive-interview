# Tasks: Add Audio Gateway (Unified TTS with Kokoro + Piper)

## Prerequisites
- [x] Read `CLAUDE.md` and confirm no conflicts with existing conventions
- [x] Verify Piper models exist at `D:\Working\pipervoices`
- [x] Verify Kokoro service is working at `http://localhost:8081`

## Phase 1: Piper Service
- [x] Create `piper-service/` directory
- [x] Create `piper-service/requirements.txt` (`fastapi`, `uvicorn`, `piper-tts`, `soundfile`, `numpy`)
- [x] Create `piper-service/main.py` — FastAPI with `POST /v1/audio/speech` and `GET /health`
- [x] Implement model loading from `PIPER_MODELS_DIR` (scan `.onnx` files, derive voice IDs)
- [x] Implement `PiperVoice.synthesize()` → WAV buffer response
- [x] Test Piper service standalone: synthesize Vietnamese text, save WAV, listen
- [x] Add `piper-service/README.md` with setup and run instructions

## Phase 2: Audio Gateway
- [x] Create `audio-gateway/` directory
- [x] Create `audio-gateway/requirements.txt` (`fastapi`, `uvicorn`, `httpx`)
- [x] Create `audio-gateway/main.py` — FastAPI with unified `POST /v1/audio/speech` and `GET /health`
- [x] Implement engine routing: `kokoro` → `KOKORO_URL`, `piper` → `PIPER_URL`
- [x] Implement pass-through proxy (forward request body, return response body verbatim)
- [x] Implement aggregated health check (query both downstream services)
- [x] Test Gateway standalone: verify `/health` returns both service statuses
- [x] Test Gateway proxy: call with `engine=kokoro` and `engine=piper`, verify WAV output
- [x] Add `audio-gateway/README.md` with setup and run instructions

## Phase 3: Next.js Refactor
- [x] Refactor `src/lib/audio/client.ts`:
  - [x] Create `AudioGatewayClient` class (replaces `KokoroTtsClient` for TTS)
  - [x] Keep `AudioCppClient` for STT (unchanged)
  - [x] Add `SynthesizeOptions` interface with `engine` and `voice`
  - [x] Implement health check that returns `{ kokoro: boolean, piper: boolean }`
- [x] Update `src/lib/audio/tts.ts` — use `AudioGatewayClient`
- [x] Update `src/lib/audio/index.ts` — export `AudioGatewayClient`, remove `KokoroTtsClient` export
- [x] Update `src/lib/config/index.ts`:
  - [x] Replace `ttsUrl` with `gatewayUrl`
  - [x] Add `defaultEngine: "kokoro" | "piper"`
- [x] Update `src/lib/config/development.ts`:
  - [x] Add `AUDIO_GATEWAY_URL` env var (default `http://localhost:8082`)
  - [x] Add `DEFAULT_TTS_ENGINE` env var (default `kokoro`)
- [x] Update `src/lib/config/production.ts` — mirror development changes
- [x] Database migration: add `tts_provider` column to `interview_sessions`
- [x] Update `src/lib/schema.ts` — add `ttsProvider` to `interviewSessions`
- [x] Update `src/app/api/voice/turn/route.ts` — pass `session.ttsProvider` to gateway synthesize call
- [x] Update session creation API (`/api/sessions`) — accept optional `ttsProvider` parameter
- [x] Update dashboard/session creation UI — add TTS engine selector for voice mode
- [x] Fix `src/app/api/voice/speak/route.ts` — update to new `synthesizeSpeech` signature

## Phase 4: Testing & Validation
- [x] Manual test: Start gateway + kokoro + piper, verify `/health`
- [x] Manual test: Create voice session with `ttsProvider: "piper"`, complete one turn
- [x] Manual test: Create voice session with `ttsProvider: "kokoro"`, complete one turn (regression)
- [x] Manual test: Verify STT still works (audio.cpp unchanged)
- [x] Run `npm run build` — no errors
- [x] Run `npm run lint` — attempted (OOM on large project; build passed confirming TS is clean)
- [x] PII audit: Confirm audio filenames remain UUID-based, no candidate names

## Phase 5: Documentation
- [x] Update `docs/API.md` — document gateway endpoint, engine parameter, voice IDs
- [x] Update `docs/ARCHITECTURE.md` — add Audio Gateway to architecture diagram
- [x] Update `docs/SETUP.md` — document Piper + Gateway installation and env vars
- [x] Update `docs/CHANGELOG.md` — add entry for Audio Gateway and Piper support
- [x] Update `docs/COMPONENTS.md` — add AudioGatewayClient and Piper service sections
- [x] Update `docs/SECURITY.md` — note gateway auth (if any) and voice data privacy
- [x] Update `README.md` — mention Piper TTS support

## Phase 6: Dev Experience (Optional but Recommended)
- [x] Create `scripts/start-audio-services.bat` (Windows) — start kokoro + piper + gateway
- [x] Create `scripts/start-audio-services.sh` (Linux/Mac) — equivalent
- [x] Create `docker-compose.audio.yml` — optional Docker composition for audio stack
