# Design: fix-voice-first-question-autoplay

## Current state

```
User clicks "Start Interview"
    │
    ├─ setInterviewStarted(true)
    │
    ▼
await /api/voice/start
    │
    ▼
setData(...) with interviewer message
    │
    ▼
useEffect runs
    │
    ├─ audioPlayerRef.current.src = audioUrl
    ├─ audioPlayerRef.current.play()  ← often blocked: user-gesture expired / audio not ready
    │
    ▼
User must press play manually ✗
```

## Target state

```
User clicks "Start Interview"
    │
    ├─ Create AudioContext
    ├─ Create SentenceAudioQueue  ← inside active user gesture
    │
    ▼
await /api/voice/start
    │
    ▼
setData(...) with interviewer message
    │
    ▼
sentenceQueueRef.current.enqueue(0, audioUrl, content)
    │
    ▼
Auto-play first question ✓
```

## Frontend change: `VoiceInterviewPage`

1. Modify `startInterview()` to return the created `VoiceMessage`.
2. In `handleStartInterview()`:
   - Create/resume `AudioContext` as before.
   - Stop any previous queue and create a fresh `SentenceAudioQueue`.
   - Set `interviewStarted` true.
   - Await `startInterview()`.
   - If the returned message has an `audioUrl`, enqueue it.
3. In `handleTurnFallback()`:
   - After `setData(...)`, enqueue the returned `interviewerMessage.audioUrl` into the already-created `SentenceAudioQueue` instead of using the `<audio>` element.
4. Remove the old `useEffect`-based autoplay that used `audioPlayerRef`.
5. Keep `audioPlayerRef` as a rarely-used fallback, but it is no longer the primary auto-play mechanism.

## Dependencies

None. Uses existing `SentenceAudioQueue` and `AudioContext` setup.

## Testing plan

1. Lint the changed file.
2. Restart the frontend dev server and run `npm run build`.
3. Manual test: open voice interview, click "Start Interview", verify audio plays without extra user action.
4. Regression: verify subsequent streaming turns still auto-play correctly.
5. Regression: switch to Standard mode or force an SSE failure and verify fallback turns also auto-play.
