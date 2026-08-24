# Design: Voice Interview (Turn-Based)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser — Voice Interview Page                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ AudioRecord │───▶│ Upload Blob │◀───│ AudioPlayer │     │
│  │   er.tsx    │    │  + Show     │    │   .tsx      │     │
│  └─────────────┘    │  Feedback   │    └─────────────┘     │
│                     └──────┬──────┘                         │
│                            │                                 │
│  GET /interview/{id}/voice │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js API Route — POST /api/voice/turn                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Validate session, check voice mode               │   │
│  │  2. Save audio blob → /tmp/audio/{sessionId}/        │   │
│  │  3. STT: POST audio.cpp /v1/audio/transcriptions     │   │
│  │  4. Store candidate message (content = transcription)│   │
│  │  5. Build prompt → call Ollama (existing pipeline)   │   │
│  │  6. TTS: POST audio.cpp /v1/audio/speech             │   │
│  │  7. Save response audio                              │   │
│  │  8. Store interviewer message (content = text)       │   │
│  │  9. Return JSON { audioUrl, textContent, msgId }     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌─────────┐    ┌─────────┐    ┌─────────┐
        │audio.cpp│    │ Ollama  │    │PostgreSQL│
        │  STT    │    │  LLM    │    │  Drizzle │
        │  TTS    │    │         │    │          │
        └─────────┘    └─────────┘    └─────────┘
```

## File Structure

```
src/
├── app/
│   ├── interview/
│   │   └── [id]/
│   │       ├── page.tsx              # Existing text interview (unchanged)
│   │       └── voice/
│   │           └── page.tsx          # NEW: VoiceInterviewPage
│   └── api/
│       ├── messages/
│       │   └── route.ts            # Existing (unchanged)
│       └── voice/
│           └── turn/
│               └── route.ts          # NEW: Voice turn handler
├── components/
│   ├── AudioRecorder.tsx             # NEW: Mic capture + waveform
│   └── AudioPlayer.tsx               # NEW: Playback with transcript toggle
├── lib/
│   ├── audio/
│   │   ├── client.ts                 # NEW: HTTP client for audio.cpp
│   │   ├── stt.ts                    # NEW: Speech-to-text wrapper
│   │   ├── tts.ts                    # NEW: Text-to-speech wrapper
│   │   └── storage.ts                # NEW: Local file save/load
│   └── config/
│       ├── index.ts                  # Add audio.cpp config fields
│       ├── development.ts            # Add defaults
│       └── production.ts             # Add defaults
```

## Database Changes

### interview_sessions
Add column:
```sql
ALTER TABLE interview_sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'text';
```

Valid values: `'text'`, `'voice'`

### messages
Add columns:
```sql
ALTER TABLE messages ADD COLUMN audio_url TEXT;
ALTER TABLE messages ADD COLUMN audio_duration_seconds INTEGER;
ALTER TABLE messages ADD COLUMN audio_format TEXT;
ALTER TABLE messages ADD COLUMN stt_confidence REAL;
```

- `audio_url` — relative path to saved audio file (e.g. `/audio/{sessionId}/{msgId}.webm`)
- `audio_duration_seconds` — optional, populated if available from MediaRecorder
- `audio_format` — mime type or extension (e.g. `webm`, `wav`)
- `stt_confidence` — optional confidence score from audio.cpp

## API Contract

### POST /api/voice/turn

**Request:** `multipart/form-data`
```
sessionId: string (UUID)
audio: Blob (audio/webm or audio/wav)
```

**Response:** `application/json`
```json
{
  "success": true,
  "candidateMessage": {
    "id": "uuid",
    "content": "Transcribed text from STT",
    "audioUrl": "/audio/{sessionId}/{msgId}.webm",
    "createdAt": "2026-08-17T10:00:00Z"
  },
  "interviewerMessage": {
    "id": "uuid",
    "content": "AI-generated question text",
    "audioUrl": "/audio/{sessionId}/{msgId}.wav",
    "createdAt": "2026-08-17T10:00:05Z"
  },
  "session": {
    "status": "in_progress",
    "currentTurn": 3,
    "maxTurns": 8
  }
}
```

**Errors:**
| Status | Condition |
|--------|-----------|
| 400 | Missing sessionId or audio |
| 401 | Session not found |
| 403 | Session is text mode or completed |
| 500 | STT/TTS/LLM failure |

## Component Design

### AudioRecorder

```
┌─────────────────────────────────────────┐
│  🎙️ Hold to speak                       │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  ▓▓▓▓░░░░▓▓░░▓▓▓▓░░░░▓▓▓▓▓░░  │   │
│  │         (live waveform)          │   │
│  └─────────────────────────────────┘   │
│           00:42                         │
│                                         │
│  [⏹️ Stop]  [🗑️ Discard]               │
└─────────────────────────────────────────┘
```

- Uses `MediaRecorder` API with `audio/webm` or `audio/wav` fallback
- Visualizes audio via `AudioContext` + `AnalyserNode`
- Emits `onRecordingComplete(blob: Blob, durationMs: number)`

### AudioPlayer

```
┌─────────────────────────────────────────┐
│  🤖 Interviewer                         │
│                                         │
│  ▶️ ───────●──────────────  00:14/01:02 │
│                                         │
│  [Show transcript ▼]                    │
│  "Can you explain the difference         │
│   between useEffect and useLayoutEffect?"│
└─────────────────────────────────────────┘
```

- HTML5 `<audio>` element with custom controls
- Toggle to show/hide transcript text
- Download button (optional)

## Data Flow: Single Turn

```
Candidate presses "Record" in AudioRecorder
    │
    ▼
MediaRecorder captures audio → Blob (webm)
    │
    ▼
Candidate presses "Stop" → onRecordingComplete(blob)
    │
    ▼
VoiceInterviewPage POST /api/voice/turn
    multipart: { sessionId, audio: blob }
    │
    ▼
API Route:
  1. Validate session exists & mode === 'voice' & status !== 'completed'
  2. Save blob → /tmp/audio/{sessionId}/{candidateMsgId}.webm
  3. STT: POST audio.cpp /v1/audio/transcriptions
     → transcription: string
  4. Insert candidate message (content = transcription, audioUrl = saved path)
  5. Build prompt from message history → call Ollama
     → questionText: string
  6. If final turn: mark completed, return completion audio/text
  7. TTS: POST audio.cpp /v1/audio/speech
     → audio buffer
  8. Save buffer → /tmp/audio/{sessionId}/{interviewerMsgId}.wav
  9. Insert interviewer message (content = questionText, audioUrl = saved path)
 10. Return JSON { candidateMessage, interviewerMessage, session }
    │
    ▼
VoiceInterviewPage:
  • Displays candidate transcription (optimistic or confirmed)
  • Plays interviewer audio via AudioPlayer
  • Updates turn counter
```

## audio.cpp Integration

### Configuration

```typescript
// src/lib/config/index.ts
interface AppConfig {
  // ... existing fields
  audio: {
    baseUrl: string;
    sttModel: string;
    ttsModel: string;
    timeoutMs: number;
  };
}
```

### HTTP Client (`src/lib/audio/client.ts`)

```typescript
class AudioCppClient {
  async transcribe(audioPath: string): Promise<{ text: string; confidence?: number }>
  async synthesize(text: string, options?: { model?: string }): Promise<Buffer>
}
```

### Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/audio/transcriptions` | POST | STT: audio file → text |
| `/v1/audio/speech` | POST | TTS: text → audio buffer |
| `/health` | GET | Liveness check at startup |

## Audio Storage

Local filesystem layout:
```
/tmp/audio/
  └── {sessionId}/
        ├── {msgId}-candidate.webm
        ├── {msgId}-interviewer.wav
        └── ...
```

Cleanup strategy (future): cron job or TTL on `/tmp/audio/*` older than 7 days.

## Error Handling

| Failure Point | Behavior |
|---------------|----------|
| STT fails | Return 500 with message "Failed to transcribe audio. Please try again." |
| LLM fails | Return 500 with message "Failed to generate question. Please try again." |
| TTS fails | Return interviewer text without audio; show "Audio unavailable" in UI |
| audio.cpp unreachable | Return 503 with message "Voice service unavailable. Switch to text mode?" |
| Invalid audio format | Return 400; client should use supported mime type |

## Performance

- **Target latency:** <10s per turn end-to-end (STT + LLM + TTS)
- **STT:** Typically 1–3s for 60s of speech
- **LLM:** Existing streaming path; but voice mode blocks until complete (no streaming)
- **TTS:** Typically 1–3s for short text
- **Audio file I/O:** Negligible for local disk

## Security

- Audio files are stored by UUID paths — no candidate names in filenames
- Same session-level access control as text interviews (UUID in URL)
- No PII in audio filenames or URLs
- audio.cpp runs on local network only (not exposed to internet)
