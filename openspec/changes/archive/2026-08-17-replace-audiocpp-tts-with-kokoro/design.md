# Design: Replace audio.cpp TTS with Kokoro

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Next.js App (port 3000)                             │
│    POST /api/voice/turn                              │
│      ├─ STT  →  audio.cpp (port 8080)                │
│      └─ TTS  →  Kokoro (port 8081)                   │
│                                                      │
│    GET  /audio/[[...path]]  →  serve stored WAVs     │
└──────────────────────────────────────────────────────┘
         │                         │
         ▼                         ▼
  ┌──────────────┐          ┌──────────────┐
  │ audio.cpp    │          │ Kokoro       │
  │  STT only    │          │  TTS only    │
  │  port 8080   │          │  port 8081   │
  └──────────────┘          └──────────────┘
```

## Component Design

### Kokoro Service (`kokoro-service/`)

```
kokoro-service/
├── main.py           # FastAPI app
├── requirements.txt  # Python deps
├── models/           # Downloaded ONNX + voicepack
│   ├── kokoro_vi.onnx
│   └── kokoro_vi_voicepack.pt
└── download_models.py  # Helper script
```

**API:**
- `POST /v1/audio/speech` — TTS synthesis
  - Body: `{"input": "text", "model": "tts", "voice": "default"}`
  - Response: `audio/wav` binary

**Why FastAPI?**
- `kokoro-onnx` is Python-native
- Simple HTTP API matches audio.cpp interface
- Can run independently (different port)

### Updated Next.js Audio Client

`src/lib/audio/client.ts` will have two clients:
- `audioClient` → unchanged (STT to audio.cpp)
- `ttsClient` → new (TTS to Kokoro)

**Config changes:**
```typescript
audio: {
  sttUrl: string;   // http://localhost:8080 (audio.cpp)
  ttsUrl: string;   // http://localhost:8081 (Kokoro)
  sttModel: string;
  ttsModel: string;
  timeoutMs: number;
}
```

## Data Flow (Voice Turn)

```
Candidate records audio
    ↓
POST /api/voice/turn (multipart)
    ↓
1. Save audio blob → /tmp/audio/{id}/
2. STT: audioClient.transcribe(path) → audio.cpp:8080
3. LLM: generateChatResponse() → Ollama:11434
4. TTS: ttsClient.synthesize(text) → Kokoro:8081  ← CHANGED
5. Save WAV → /tmp/audio/{id}/
6. Return JSON with audioUrl
    ↓
Candidate sees/hears interviewer response
```

## Dependencies

### New Python Dependencies
- `fastapi` + `uvicorn` — HTTP server
- `kokoro-onnx` — TTS inference
- `soundfile` — WAV output

### No New JS Dependencies
- Use existing `fetch` and `Blob` APIs

## Environment Variables

```bash
# Existing
AUDIOCPP_BASE_URL=http://localhost:8080
AUDIOCPP_STT_MODEL=stt

# New
KOKORO_BASE_URL=http://localhost:8081
KOKORO_TTS_MODEL=tts
```

## Security Notes

- Kokoro service binds to `localhost:8081` only (not `0.0.0.0`)
- No auth needed (local service)
- Audio files still served via `/audio/[[...path]]` with path traversal protection
