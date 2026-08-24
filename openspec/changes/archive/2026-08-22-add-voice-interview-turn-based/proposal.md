# Proposal: Add Voice Interview (Turn-Based)

## Problem
The Adaptive Interview Engine is text-only. Candidates must type answers, which creates friction for:
- Candidates with motor disabilities or dyslexia
- Candidates who are stronger verbal communicators than writers
- Hiring managers who want to assess vocal communication skills (clarity, confidence, pace)

External voice inference tools exist (audio.cpp, whisper.cpp, etc.), but the engine has no integration path for speech-to-text or text-to-speech.

## Solution
Add an optional **turn-based voice interview mode** alongside the existing text mode. In voice mode:
1. Candidate records their answer via microphone (browser)
2. Server transcribes audio via audio.cpp (STT)
3. Existing LLM pipeline generates the next question (unchanged)
4. Server synthesizes the question via audio.cpp (TTS)
5. Candidate hears the AI interviewer's voice

Text mode remains the default and is untouched.

## Scope
1. **Database:** Add `mode` column to `interview_sessions`; add audio metadata columns to `messages`
2. **API:** New route `POST /api/voice/turn` — handles audio upload, STT, LLM, TTS, returns audio URL
3. **Frontend:** New page `/interview/[id]/voice` with audio recorder, player, and turn-based UX
4. **Audio client:** `src/lib/audio/` — HTTP client for audio.cpp STT/TTS, local file storage
5. **Components:** `AudioRecorder`, `AudioPlayer`, `VoiceInterviewPage`
6. **Config:** `AUDIOCPP_BASE_URL`, `AUDIOCPP_STT_MODEL`, `AUDIOCPP_TTS_MODEL` env vars
7. **Documentation:** Update `API.md`, `ARCHITECTURE.md`, `COMPONENTS.md`, `SETUP.md`, `CHANGELOG.md`

## Non-goals
- **No real-time streaming** — turn-based only; no WebRTC, no VAD, no interruption handling
- **No text mode removal** — text remains default; voice is opt-in per session
- **No voice evaluation metrics** — acoustic analysis (WPM, fillers, pitch) is out of scope for this change
- **No audio storage beyond local filesystem** — S3/MinIO integration is a future enhancement
- **No transcript page audio playback** — recruiters still see text transcripts; audio playback in review is future work
- **No voice cloning / persona consistency** — uses default TTS voice

## Risks
| Risk | Mitigation |
|------|------------|
| audio.cpp adds heavy native dependency | Document as optional; voice mode requires local audio.cpp server |
| Per-turn latency (3–10s) feels broken | Strong UI feedback: "Transcribing...", "Interviewer is thinking...", "Generating voice..." |
| Audio files bloat disk | Store in `/tmp/audio/{sessionId}/`; add cleanup cron or TTL |
| Privacy / GDPR with voice data | Same anonymization rules as text; voice files tied to session UUID, not candidate name |
| Browser audio API incompatibility | Support MediaRecorder with fallback; test Chrome, Firefox, Safari |
| audio.cpp HTTP API changes | Wrap in `src/lib/audio/client.ts`; isolate integration point |

## Success Criteria
- [x] Candidate can start a voice interview and complete all turns
- [x] Text interviews continue to work exactly as before
- [x] `POST /api/voice/turn` returns JSON with `audioUrl`, `transcription`, `textContent`
- [x] `npm run build` and `npm run lint` pass
- [x] Docs updated: `API.md`, `ARCHITECTURE.md`, `COMPONENTS.md`, `SETUP.md`, `CHANGELOG.md`
