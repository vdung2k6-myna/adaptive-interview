# Design: Audio Gateway (Unified TTS)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App ( :3000 )                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  src/lib/audio/client.ts                              │  │
│  │    AudioGatewayClient                                 │  │
│  │      POST {text, engine, voice}                     │  │
│  │      ─────────────────────────────────────────────▶   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP POST /v1/audio/speech
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Audio Gateway (FastAPI, :8082)                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  POST /v1/audio/speech                                │  │
│  │  Body: { text, engine?: "kokoro"|"piper", voice? }    │  │
│  │                                                       │  │
│  │  ┌────────────┐      ┌────────────┐                  │  │
│  │  │  Router    │─────▶│   Kokoro   │  :8081          │  │
│  │  │            │      │  Service   │                  │  │
│  │  │  engine    │      └────────────┘                  │  │
│  │  │  selector  │      ┌────────────┐                  │  │
│  │  │            │─────▶│   Piper    │  :8083          │  │
│  │  └────────────┘      │  Service   │                  │  │
│  │                      └────────────┘                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Audio Gateway (`audio-gateway/`)

```python
# audio-gateway/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx

app = FastAPI(title="Audio Gateway", version="1.0.0")

KOKORO_URL = os.environ.get("KOKORO_URL", "http://localhost:8081")
PIPER_URL  = os.environ.get("PIPER_URL", "http://localhost:8083")

class SynthesizeRequest(BaseModel):
    text: str
    engine: Literal["kokoro", "piper"] = "kokoro"
    voice: str | None = None
    model: str | None = None

@app.post("/v1/audio/speech")
async def synthesize(req: SynthesizeRequest):
    if req.engine == "kokoro":
        return await _proxy_to_kokoro(req)
    elif req.engine == "piper":
        return await _proxy_to_piper(req)
    raise HTTPException(400, f"Unknown engine: {req.engine}")

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "kokoro": await _check(KOKORO_URL),
        "piper": await _check(PIPER_URL),
    }
```

**Responsibilities:**
- Validate input (text non-empty, engine recognized)
- Proxy request to correct downstream service
- Return downstream response verbatim (pass-through WAV)
- Aggregate health checks

**Not responsible for:**
- Audio file storage (Next.js handles that)
- Model loading (downstream services handle that)
- STT (audio.cpp stays direct)

### 2. Piper Service (`piper-service/`)

```python
# piper-service/main.py
from fastapi import FastAPI
from piper import PiperVoice  # or subprocess to piper binary

app = FastAPI(title="Piper TTS Service", version="1.0.0")

# Load all models from PIPER_MODELS_DIR
_voices: dict[str, PiperVoice] = {}

def _load_voices():
    models_dir = Path(os.environ.get("PIPER_MODELS_DIR", "/app/models"))
    for onnx_file in models_dir.rglob("*.onnx"):
        voice_id = _voice_id_from_path(onnx_file)
        _voices[voice_id] = PiperVoice.load(str(onnx_file))

@app.post("/v1/audio/speech")
async def synthesize(req: SynthesizeRequest):
    voice = _voices.get(req.voice or "vais1000-medium")
    audio = voice.synthesize(req.text)
    return Response(content=audio_to_wav(audio), media_type="audio/wav")
```

**Voice ID convention:**
Derived from the `.onnx` filename minus extension:
- `vi_VN-vais1000-medium.onnx` → voice ID: `vi_VN-vais1000-medium`
- `vi_VN-vivos-x_low.onnx` → voice ID: `vi_VN-vivos-x_low`
- `vi_VN-25hours_single-low.onnx` → voice ID: `vi_VN-25hours_single-low`

### 3. Next.js Audio Client Refactor

```typescript
// src/lib/audio/client.ts
export interface SynthesizeOptions {
  engine?: "kokoro" | "piper";
  voice?: string;
  model?: string;
}

export class AudioGatewayClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor() {
    this.baseUrl = config.audio.gatewayUrl.replace(/\/$/, "");
    this.timeoutMs = config.audio.timeoutMs;
  }

  async synthesize(text: string, options?: SynthesizeOptions): Promise<Buffer> {
    const body = JSON.stringify({
      text,
      engine: options?.engine ?? config.audio.defaultEngine,
      voice: options?.voice ?? config.audio.defaultVoice,
      model: options?.model,
    });
    // POST to gateway /v1/audio/speech
    // Return Buffer
  }

  async healthCheck(): Promise<{ kokoro: boolean; piper: boolean }> {
    // GET /health on gateway
  }
}

// Remove KokoroTtsClient, AudioCppClient#synthesize stays for now
// (STT is still direct to audio.cpp)
```

### 4. Database Schema Change

```typescript
// src/lib/schema.ts
export const interviewSessions = pgTable("interview_sessions", {
  // ... existing columns ...
  mode: text("mode").$type<"text" | "voice">().default("text"),
  ttsProvider: text("tts_provider").$type<"kokoro" | "piper">().default("kokoro"),
});
```

### 5. Config Changes

```typescript
// src/lib/config/index.ts
audio: {
  sttUrl: string;        // audio.cpp (unchanged)
  gatewayUrl: string;      // NEW: Audio Gateway TTS endpoint
  sttModel: string;
  defaultEngine: "kokoro" | "piper";  // NEW
  defaultVoice: string;    // voice ID, e.g. "diem_trinh" (kokoro) or "vi_VN-vais1000-medium" (piper)
  timeoutMs: number;
}
```

**Environment variables:**
- `AUDIO_GATEWAY_URL` (replaces `KOKORO_BASE_URL` for TTS)
- `KOKORO_BASE_URL` (still needed for gateway to proxy)
- `PIPER_BASE_URL` (new, for gateway to proxy)
- `PIPER_MODELS_DIR` (for piper-service)

### 6. API Route Changes

```typescript
// src/app/api/voice/turn/route.ts
// Replace:
//   import { synthesizeSpeech } from "@/lib/audio/tts";
// With:
//   import { audioGateway } from "@/lib/audio/client";

// In handler:
const ttsProvider = session.ttsProvider || "kokoro";
const ttsBuffer = await audioGateway.synthesize(questionText, {
  engine: ttsProvider,
});
```

## Data Flow: Single Voice Turn

```
Browser → POST /api/voice/turn (multipart: sessionId + audio blob)
    │
    ▼
Route handler → save candidate audio → STT (audio.cpp direct)
    │
    ▼
Route handler → build prompt → Ollama → questionText
    │
    ▼
Route handler → audioGateway.synthesize(questionText, { engine: session.ttsProvider })
    │
    ▼
POST {text, engine, voice} → Audio Gateway :8082
    │
    ▼
Gateway → POST {text, voice} → Kokoro :8081  OR  Piper :8083
    │
    ▼
Gateway ← WAV response
    │
    ▼
Route handler ← Buffer
    │
    ▼
Save to disk → store message → return JSON
```

## Error Handling

| Scenario | Gateway Behavior | Next.js Behavior |
|----------|-----------------|------------------|
| Unknown engine | 400 Bad Request | Log error, fallback to text-only response |
| Downstream TTS timeout | 504 Gateway Timeout | Log error, continue without audio |
| Downstream TTS 500 | 502 Bad Gateway | Log error, continue without audio |
| Gateway unreachable | Connection refused | Log error, treat as audio unavailable |
| Invalid voice ID | 400 (from Piper service) | Log error, retry with default voice |

## File Structure

```
ollama-chat-react/
├── audio-gateway/
│   ├── main.py
│   ├── requirements.txt
│   └── README.md
├── piper-service/
│   ├── main.py
│   ├── requirements.txt
│   └── README.md
├── kokoro-service/           # unchanged
│   └── ...
├── src/
│   ├── lib/
│   │   └── audio/
│   │       ├── client.ts     # refactor: AudioGatewayClient
│   │       ├── stt.ts        # unchanged (audio.cpp direct)
│   │       ├── tts.ts        # refactor: use gateway
│   │       └── index.ts      # update exports
│   └── ...
└── docs/
    └── ...
```

## Testing Strategy

1. **Unit: Gateway routing**
   - Mock httpx client, verify correct downstream URL called per engine
2. **Integration: Piper service**
   - Load `vais1000-medium` model, synthesize "Xin chào", verify WAV output
3. **Integration: End-to-end voice turn**
   - Create voice session with `ttsProvider: "piper"`
   - Submit audio, verify response contains interviewer audio
4. **Regression: Kokoro path**
   - Create voice session with `ttsProvider: "kokoro"` (default)
   - Verify same behavior as before
5. **Health check:**
   - Verify `/health` returns status for both kokoro and piper

## Performance Considerations

- **Gateway proxying overhead:** ~1-3ms per request (same-machine HTTP)
- **Piper latency:** Expected ~50-200ms on CPU (typically faster than Kokoro's 200-500ms)
- **Model loading:** Piper models loaded once at service startup (not per-request)
- **Memory:** Each loaded Piper model stays in RAM (~50-150MB per model)

## Future Extensions

- **Fallback:** If `engine=piper` fails, gateway could retry with `engine=kokoro`
- **Caching:** Gateway could cache synthesized audio by `(text, engine, voice)` hash
- **Metrics:** Gateway could emit per-engine latency metrics
- **Streaming:** If Piper supports chunked synthesis, gateway could stream WAV chunks
