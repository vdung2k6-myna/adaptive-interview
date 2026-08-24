# Proposal: Add Audio Gateway (Unified TTS with Kokoro + Piper)

## Problem
The Adaptive Interview Engine currently talks to two separate TTS services (Kokoro on :8081, and soon Piper on another port) via two distinct client classes (`KokoroTtsClient`, future `PiperTtsClient`). This creates several issues:

1. **Next.js knows too much about audio internals** — it must understand engine-specific URLs, voice names, and model parameters.
2. **Adding a new TTS engine means touching Next.js code** — violates the principle that audio is an external concern.
3. **No unified health check or fallback** — if one TTS engine fails, there's no graceful degradation.
4. **Future backend split is harder** — the MCP server change already hints at separating the API layer from Next.js. Audio should follow the same pattern.

## Solution
Introduce an **Audio Gateway** — a lightweight HTTP proxy/gateway service that exposes a single unified TTS endpoint. The gateway internally routes to Kokoro or Piper based on a request parameter. Next.js only ever sees one URL.

```
Next.js App (:3000)
    │ POST /v1/audio/speech { text, engine, voice }
    ▼
Audio Gateway (:8082)
    ├─ engine=kokoro ──▶ Kokoro Service (:8081)
    └─ engine=piper  ──▶ Piper Service (:8083)
```

## Scope
1. **Create `audio-gateway/`** in-repo FastAPI service with unified `POST /v1/audio/speech` endpoint
2. **Create `piper-service/`** in-repo FastAPI wrapper for Piper TTS (`piper-tts` Python package or binary)
3. **Refactor `src/lib/audio/client.ts`** — replace `KokoroTtsClient` + future `PiperTtsClient` with single `AudioGatewayClient`
4. **Update config** — `audio.gatewayUrl` replaces `audio.ttsUrl` + `audio.ttsUrlPiper`
5. **Add per-session TTS provider selection** — `interview_sessions.ttsProvider` column (`kokoro` | `piper`)
6. **Update voice interview turn handler** — pass `ttsProvider` from session to gateway
7. **Update session creation flow** — allow recruiters to choose TTS engine when creating voice sessions
8. **Documentation** — `API.md`, `ARCHITECTURE.md`, `SETUP.md`, `CHANGELOG.md`

## Non-goals
- **No STT abstraction** — audio.cpp STT stays direct; this change is TTS-only.
- **No real-time streaming** — gateway returns complete WAV buffers, same as today.
- **No audio storage in gateway** — Next.js still saves audio via `src/lib/audio/storage.ts`.
- **No load balancing / clustering** — single gateway instance is sufficient for now.
- **No voice cloning or custom model uploads** — only pre-configured models.

## Risks
| Risk | Mitigation |
|------|------------|
| Gateway adds latency (extra HTTP hop) | Gateway and services run on same machine locally; overhead is ~1-2ms proxying |
| Piper Python package (`piper-tts`) has espeak-ng dependency | Document in `SETUP.md`; provide Windows + Linux install steps |
| Gateway becomes a single point of failure | Gateway is stateless; can be restarted instantly. Fallback to direct Kokoro URL can be added later. |
| Two new services to manage in dev | Provide `docker-compose.yml` or a single `start-services.bat` script |
| Existing Kokoro service refactor breaks working code | Keep Kokoro service untouched; gateway proxies to it unchanged |

## Success Criteria
- [x] Next.js makes TTS requests to a single `AUDIO_GATEWAY_URL`
- [x] Gateway routes `engine=piper` to Piper service, `engine=kokoro` to Kokoro service
- [x] Voice interview can run with Piper selected as the TTS engine
- [x] Voice interview can run with Kokoro selected (regression)
- [x] `npm run build` and `npm run lint` pass
- [x] All relevant docs updated (`API.md`, `ARCHITECTURE.md`, `SETUP.md`, `CHANGELOG.md`)
