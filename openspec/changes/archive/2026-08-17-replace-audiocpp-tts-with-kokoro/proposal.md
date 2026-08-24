# Replace audio.cpp TTS with Kokoro

## Problem

audio.cpp TTS is too slow for real-time voice interviews. Measured at ~46 seconds per sentence on an RTX 3050 4GB (CPU fallback due to VRAM exhaustion). An 8-turn interview would spend ~6+ minutes generating interviewer audio, making the experience unusable.

## Solution

Replace the local audio.cpp TTS endpoint with a **Kokoro FastAPI service**:

- **Kokoro**: 82M-param lightweight TTS model, ~300MB ONNX (~80MB quantized)
- **Speed**: 200-500ms per sentence (real-time on CPU)
- **Quality**: Comparable to commercial APIs
- **Vietnamese**: Community model `Kokoro-Vietnamese` available

audio.cpp remains for STT (transcription) since it works fine.

## Scope

### In Scope
- Create `kokoro-service/` Python FastAPI app with Kokoro TTS
- Update `src/lib/audio/client.ts` to support dual endpoints (STT → audio.cpp, TTS → Kokoro)
- Update config (`src/lib/config/*.ts`) for separate STT/TTS URLs
- Update `.env.local` docs for new env vars
- Update `docs/SETUP.md`, `docs/API.md`, `docs/CHANGELOG.md`

### Out of Scope
- Replacing STT (audio.cpp STT stays)
- Cloud API fallback (OpenAI/Azure)
- Changing the voice interview UX flow

## Risks

| Risk | Mitigation |
|------|-----------|
| Kokoro Vietnamese model quality | Test before production; fallback to audio.cpp if needed |
| Another process to manage | Provide `scripts/start-kokoro.ps1` helper |
| Python dependency | Document `requirements.txt`, virtualenv setup |

## Success Criteria

- [ ] TTS synthesis completes in <1 second (was 46s)
- [ ] Vietnamese text synthesizes correctly
- [ ] Voice interview completes end-to-end with audio playback
- [ ] Text interviews still work (regression)
- [ ] All docs updated
