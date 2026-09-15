## Why

Several recent features (interview language support, Supertonic TTS engine, Voice Agent page, PWA, streaming audio optimizations) have been implemented and shipped, but the developer-facing documentation has drifted. The `docs/OPENSPEC.md` active-changes table lists completed/archived work, the root `README.md` omits the Voice Agent and Supertonic, and `docs/COMPONENTS.md` omits the Voice Agent page. Stale docs mislead developers and contradict the project's "outdated documentation is a bug" principle.

## What Changes

- Update `docs/OPENSPEC.md` — replace the stale "Current Active Changes" table with the actual in-flight changes listed under `openspec/changes/active/`
- Update `README.md` — add **Supertonic** to the voice engines list, add **Voice Agent** (`/voice-agent`) to Features and Usage Flow
- Update `docs/COMPONENTS.md` — add `VoiceAgentPage` to page components and component-relationships diagram
- Update `docs/ARCHITECTURE.md` — mention Supertonic alongside Kokoro/Piper in voice sections
- Update `docs/SETUP.md` — add `npm run pwa:assets` to the scripts table, add Voice Agent to the verification checklist

## Capabilities

No new or modified capabilities — this is a documentation-only change. No spec-level behavior changes.

## Non-goals

- No source code changes
- No backend documentation changes (those live in `adaptive-interview-api`)
- No new features or bug fixes

## Impact

- Affected files: `docs/OPENSPEC.md`, `README.md`, `docs/COMPONENTS.md`, `docs/ARCHITECTURE.md`, `docs/SETUP.md`
- No runtime, API, or dependency impact
- Zero risk — only Markdown edits
