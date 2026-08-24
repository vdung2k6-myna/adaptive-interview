# Tasks: Replace audio.cpp TTS with Kokoro

## Phase 1: Kokoro Service Setup
- [ ] Create `kokoro-service/` directory
- [ ] Write `requirements.txt` with fastapi, uvicorn, kokoro-onnx, soundfile
- [ ] Write `main.py` FastAPI app with TTS endpoint
- [ ] Write `download_models.py` helper to fetch Vietnamese ONNX model
- [ ] Test Kokoro service standalone (`python main.py`)

## Phase 2: Next.js Integration
- [ ] Update `src/lib/config/index.ts` with separate sttUrl/ttsUrl
- [ ] Update `src/lib/config/development.ts` and `production.ts`
- [ ] Refactor `src/lib/audio/client.ts` → split into `stt.ts` (audio.cpp) and `tts.ts` (Kokoro)
- [ ] Update `src/lib/audio/index.ts` exports
- [ ] Update `src/app/api/voice/turn/route.ts` and `start/route.ts` to use new TTS client
- [ ] Test build + lint

## Phase 3: Documentation
- [ ] Update `docs/SETUP.md` with Kokoro installation steps
- [ ] Update `docs/API.md` with new endpoints
- [ ] Update `docs/ARCHITECTURE.md` with dual-service diagram
- [ ] Update `docs/CHANGELOG.md`

## Phase 4: Validation
- [ ] Run `npm run build` — passes
- [ ] Run `npm run lint` — passes
- [ ] Manual test: TTS synthesizes Vietnamese in <1s
- [ ] Manual test: Voice interview completes end-to-end
- [ ] Regression: Text interviews still work
