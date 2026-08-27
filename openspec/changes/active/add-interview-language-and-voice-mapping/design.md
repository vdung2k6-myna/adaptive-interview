# Design: Add Interview Language and Engine Voice Mapping

## Data Model

```
interview_sessions
├── id
├── position_id
├── candidate_id
├── status
├── mode: "text" | "voice"
├── tts_provider: "kokoro" | "piper"
├── language: "english" | "vietnamese"   ← new (default "english")
├── max_turns
├── current_turn
└── created_at
```

The `language` column is a `text` field with a check constraint or application-level validation. Default value is `"english"` so existing rows and new sessions without a value remain English.

## Flow

### Session creation

```
SetupForm
  │
  ▼
POST /api/sessions
  { positionId, candidateId, mode, ttsProvider, language }
  │
  ▼
Express backend inserts interview_session with language
```

### Interview generation

```
GET /api/sessions/:id
  returns session.language
  │
  ▼
InterviewPage / VoiceInterviewPage
  │
  ▼
POST /api/messages or /api/voice/turn or /api/voice/stream
  │
  ▼
Backend: buildPrompt(session, messages)
  - system prompt: "Conduct the interview in {language}."
  - context prompt: position + candidate + turn history
  - LLM generates question in {language}
```

### TTS synthesis

```
Voice / Transcript playback
  │
  ▼
Backend voice route
  │
  ▼
resolveVoice(engine, language)
  │
  ├─ kokoro + english  → "af_heart"      (English voice to download/install)
  ├─ kokoro + vietnamese → current default  (keep existing installed voice)
  ├─ piper + english   → "en_US-lessac-medium"  (English voice to download/install)
  └─ piper + vietnamese → current default       (keep existing installed voice)
  │
  ▼
AudioGateway.synthesize(text, { engine, voice })
```

### Evaluation

```
POST /api/sessions/:id/evaluate
  │
  ▼
Backend reads session.language
  │
  ▼
Evaluation prompt system message:
  "Review the interview and produce all feedback in {language}."
  │
  ▼
LLM returns scores + strengths/weaknesses/recommendation in {language}
```

## Backend Component Changes

### 1. Schema

File: `adaptive-interview-api/src/lib/schema.ts`

Add `language` to `interviewSessions`:

```ts
language: text("language").notNull().default("english"),
```

### 2. Config

File: `adaptive-interview-api/src/lib/config/index.ts`

Add voice map to `AppConfig`:

```ts
audio: {
  // ...existing fields...
  voices: {
    kokoro: {
      english: string;
      vietnamese: string;
    };
    piper: {
      english: string;
      vietnamese: string;
    };
  };
}
```

File: `adaptive-interview-api/src/lib/config/development.ts` and `production.ts`

English voices are explicit defaults; Vietnamese voices intentionally fall back to the currently installed service defaults so existing deployments keep working.

```ts
voices: {
  kokoro: {
    english: process.env.KOKORO_VOICE_ENGLISH || "af_heart",
    // Empty/null means "let the Kokoro service pick its current default voice"
    vietnamese: process.env.KOKORO_VOICE_VIETNAMESE || "",
  },
  piper: {
    english: process.env.PIPER_VOICE_ENGLISH || "en_US-lessac-medium",
    // Empty/null means "let the Piper service pick its current default voice"
    vietnamese: process.env.PIPER_VOICE_VIETNAMESE || "",
  },
}
```

The `resolveVoice` helper only forwards `voice` to the Audio Gateway when the configured value is non-empty. This preserves the existing Vietnamese defaults while allowing explicit override via environment variables.

### 3. Helper: resolve voice

File: `adaptive-interview-api/src/lib/audio/text-processing.ts` or a new helper.

```ts
export function resolveVoice(
  engine: "kokoro" | "piper",
  language: "english" | "vietnamese"
): string | undefined {
  const voice = config.audio.voices[engine][language]?.trim();
  // Empty string means "use the service's current default".
  // This keeps existing Vietnamese voices unchanged.
  return voice || undefined;
}
```

### 4. Prompts

File: `adaptive-interview-api/src/lib/prompts.ts`

- Add `language` to `PromptSession`.
- Update `buildSystemPrompt(language)`:

```
You are an experienced technical interviewer conducting a structured interview.
Rules:
- ...
- Conduct the entire interview in {language}. Questions, explanations, and replies must be in {language} only.
```

- Update `buildPrompt` signature to accept `session.language` and pass it to `buildSystemPrompt`.

### 5. Evaluation

File: `adaptive-interview-api/src/lib/evaluation.ts`

Add language rule to the evaluation system prompt. If the function currently takes `session` or `messages`, it should also read `session.language`.

### 6. Session routes

File: `adaptive-interview-api/src/routes/sessions.ts`

- `POST /api/sessions`: accept `language` from body, default to `"english"`, validate against allowed values.
- `GET /api/sessions/:id`: include `language` in the response.

### 7. Voice routes

File: `adaptive-interview-api/src/routes/voice.ts`

- `/start`, `/turn`, `/stream`: read `session.language` alongside `session.ttsProvider`, call `resolveVoice`, and pass `voice` to `synthesizeSpeechWithFallback` and `synthesizeLongText`.
- `/speak`, `/speak-stream`: accept an optional `language` in the request body (default `"english"`), resolve the voice, and pass it to TTS.

Update `SynthesizeOptions` usage so `voice` is provided explicitly for all session-based synthesis.

### 8. TTS pipeline

File: `adaptive-interview-api/src/lib/audio/text-processing.ts`

- `synthesizeLongText`, `synthesizeSpeechWithFallback`, `synthesizeChunkWithFallback` already accept `voice` in `SynthesizeOptions`.
- Ensure all callers pass the resolved voice.

### 9. Evaluation route

File: `adaptive-interview-api/src/routes/evaluations.ts`

- `POST /api/sessions/:id/evaluate`: read `session.language` and pass it to the evaluation prompt builder.

## Frontend Component Changes

### 1. SetupForm

File: `src/app/setup/SetupForm.tsx`

Add a language selector below or next to the TTS provider selector:

```tsx
const [language, setLanguage] = useState<"english" | "vietnamese">("english");
```

Send it in the POST body:

```ts
body: JSON.stringify({ positionId, candidateId, mode, ttsProvider, language })
```

### 2. Transcript page

File: `src/app/interview/[id]/transcript/page.tsx`

- `SessionData` interface already includes `session.ttsProvider`; add `session.language`.
- When calling `speakMessageStream`, pass `sessionData.session.language` to the backend `/api/voice/speak-stream` endpoint (update the POST body to include `language`).

No frontend voice mapping is needed; the backend resolves the voice.

### 3. Text interview page

File: `src/app/interview/[id]/page.tsx`

- Add `language` to `SessionData` interface.
- Display session language somewhere subtle (optional).
- The text mode still sends `POST /api/messages`; the backend uses `session.language` when building the prompt.

### 4. Voice interview page

File: `src/app/interview/[id]/voice/page.tsx`

- Add `language` to session data interface if not already present.
- No direct change needed for TTS voice; the backend resolves it from session.

## API Changes

### `POST /api/sessions`

Request body adds:

```json
{
  "positionId": "...",
  "candidateId": "...",
  "mode": "voice",
  "ttsProvider": "kokoro",
  "language": "vietnamese"
}
```

### `GET /api/sessions/:id`

Response includes:

```json
{
  "session": { "language": "vietnamese" },
  ...
}
```

### `POST /api/voice/speak` and `/api/voice/speak-stream`

Request body adds optional `language`:

```json
{ "text": "...", "engine": "kokoro", "language": "english" }
```

If omitted, backend defaults to `"english"`.

## Environment Variables

Add these to the backend `.env` file and documentation:

```bash
# TTS voice mapping
KOKORO_VOICE_ENGLISH=af_heart
# KOKORO_VOICE_VIETNAMESE=         # leave unset to keep current default
PIPER_VOICE_ENGLISH=en_US-lessac-medium
# PIPER_VOICE_VIETNAMESE=          # leave unset to keep current default
```

## English Voice Model Installation

Before English TTS works, the English voices must be installed in each service.

### Kokoro

The current `kokoro-service` loads a Vietnamese model (`kokoro_vi.pth`).
To support English with Kokoro, either:

1. Replace / extend the service with an English Kokoro model that includes the voice `af_heart`, or
2. Keep the Vietnamese model as-is and use **Piper for English interviews** until an English Kokoro model is added.

Recommended English voice: `af_heart` (American female, widely available in Kokoro 82M packs).

### Piper

Download the English Piper voice into your `pipervoices` directory:

- Voice ID: `en_US-lessac-medium`
- Download from the [Piper release page](https://github.com/rhasspy/piper/releases) or Hugging Face mirror.
- Place both files in `pipervoices/`:
  - `en_US-lessac-medium.onnx`
  - `en_US-lessac-medium.onnx.json`

The Piper service auto-discovers the new voice on next restart.

## Documentation Updates

- `docs/API.md`: add `language` field to session creation and voice endpoints.
- `docs/ARCHITECTURE.md`: update interview/evaluation flow to mention language rule and voice mapping.
- `docs/SETUP.md`: add new environment variables.
- `docs/CHANGELOG.md`: add dated entry for the feature.

## Manual Validation

1. Create a Vietnamese voice interview and verify the first question is in Vietnamese.
2. Answer in English; verify the next question stays in Vietnamese.
3. Verify TTS uses the Vietnamese voice.
4. Complete the interview, then view the transcript. Click **Speak** and verify Vietnamese playback.
5. Generate an evaluation and verify `strengths`/`weaknesses` are in Vietnamese.
6. Repeat for English.
7. Run `npm run build` and `npm run lint` in both repos.
