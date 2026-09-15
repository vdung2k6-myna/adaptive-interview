## Context

The frontend documentation (`docs/` and `README.md`) has fallen behind the source code. The last major doc-sync was the `consolidate-docs-in-backend` change (2026-08-27), after which several features landed without updating all affected documents:

- Interview language support (`add-interview-language-and-voice-mapping`)
- Voice Agent page (`add-voice-agent-page`)
- Supertonic TTS engine (`add-supertonic-tts-engine`)
- Streaming latency reduction (`reduce-speak-first-chunk-latency`)
- SSE audio cleanup fix (`fix-sse-audio-chunk-cleanup`)
- LLM repetition fix (`fix-llm-repetition-tts`)
- Mobile adaptive UI (`adaptive-mobile-ui`)
- PWA iOS support (`add-pwa-ios-installability`) and Android support

`CHANGELOG.md` is already current (it was updated as each change was implemented). The remaining drift is in reference docs that developers read for orientation: `README.md`, `OPENSPEC.md`, `COMPONENTS.md`, `ARCHITECTURE.md`, and `SETUP.md`.

## Goals / Non-Goals

**Goals:**
- Ensure every feature mentioned in `CHANGELOG.md` is also discoverable in the developer-facing reference docs
- Eliminate stale/cancelled entries in the OpenSpec active-changes table
- Keep the root `README.md` as an accurate feature overview

**Non-Goals:**
- Rewriting existing content that is already accurate
- Backend documentation changes (handled in `adaptive-interview-api`)
- Restructuring docs (e.g., splitting files) unless required by new content

## Decisions

### Decision: Direct edits, not doc-generation tooling
**Chosen:** Edit Markdown files by hand rather than generating from source.
**Rationale:** The codebase is small enough that manual inspection is reliable. Doc-generation tooling would add a dependency and maintenance burden for minimal gain.
**Alternative considered:** A script that parses `openspec/changes/active/` and component files to auto-update docs. Rejected — adds complexity for a one-time sync.

### Decision: Update in-place, keep existing style
**Chosen:** Follow each document's existing formatting, heading levels, and link patterns.
**Rationale:** Minimizes diff noise and reviewer cognitive load. The current docs are well-structured; preserving style is faster than reformatting.

## Risks / Trade-offs

- **Risk:** Missing a small drift (e.g., a new component not documented).  
  → Mitigation: Scan `src/components/`, `src/app/`, and recent `git log --name-only` for anything not in docs. Already done during exploration.
- **Risk:** Future docs drift again.  
  → Mitigation: Already addressed by the project rule in `CLAUDE.md` — "Outdated documentation is a bug. Update docs with every change." This change is a corrective application of that rule.

## Migration Plan

Not applicable — no runtime migration. Reviewers verify by spot-checking the edited Markdown against the source.
