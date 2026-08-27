# Fix voice first question auto-play

**Change:** `fix-voice-first-question-autoplay`

## Problem

In voice interview mode, after the user clicks "Start Interview", the first interviewer question is generated and displayed, but its audio does **not** play automatically. The user has to press the play button on the `AudioPlayer` card to hear the question. The same issue existed in the non-streaming fallback turn path (`/api/voice/turn`), which also used the hidden `<audio>` element.

The previous implementation used a hidden `<audio>` element and a `useEffect`/fallback handler that called `.play()` only after the async API round-trip finished. By that time the browser's user-gesture permission for autoplay had often expired (especially on mobile), and the audio element was not guaranteed to be ready.

## Solution

Move first-question and fallback autoplay into the same user-gesture handler that creates the `AudioContext`:

1. On click, create/resume `AudioContext`.
2. Immediately create a `SentenceAudioQueue` from the same user gesture.
3. Call the API endpoint.
4. When the response returns, enqueue the interviewer audio URL into the queue, which starts playback immediately.

This matches the existing streaming-turn behavior and keeps playback within the browser's autoplay window.

## Scope

### In scope

- `adaptive-interview/src/app/interview/[id]/voice/page.tsx` — first-question and fallback-turn auto-play.
- `docs/COMPONENTS.md` — document the new flow.
- `docs/CHANGELOG.md` — add entry.

### Out of scope

- Backend TTS or streaming routes.
- `AudioPlayer` component behavior.
- Transcript page "Speak" button.

## Non-goals

- No new dependencies.
- No API changes.

## Risks

| Risk | Mitigation |
|------|-----------|
| Creating queue before API call wastes resources if API fails | Queue is cheap; it will simply never enqueue audio. |
| Double audio if old autoplay effect also fires | Remove the old `useEffect` autoplay. |
| Page refresh mid-interview tries to autoplay | Not supported; user can press play manually. |

## Success Criteria

- [ ] Clicking "Start Interview" auto-plays the first question audio.
- [ ] No manual "play" button press needed for the first question.
- [ ] Fallback turns (`/api/voice/turn`) also auto-play the interviewer response.
- [ ] Streaming turns continue to stream/play as before.
- [ ] Build passes after frontend dev server is restarted.
