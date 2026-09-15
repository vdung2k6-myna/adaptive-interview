## 1. Update OpenSpec Active Changes Table

- [x] 1.1 Replace the stale "Current Active Changes" table in `docs/OPENSPEC.md` with the actual in-flight changes from `openspec/changes/active/`
- [x] 1.2 Move completed/archived entries (`add-pwa-android-installability`, `add-pwa-ios-installability`, `fix-audio-streaming-stop-regressions`) to the Archived Changes table with correct dates
- [x] 1.3 Verify the new table renders correctly in Markdown preview

## 2. Update Root README.md

- [x] 2.1 Add **Supertonic** to the Voice Interviews feature bullet alongside Kokoro and Piper
- [x] 2.2 Add a **Voice Agent** bullet to the Features list (`/voice-agent` — ephemeral voice/text agent chat)
- [x] 2.3 Add Voice Agent (`/voice-agent`) to the Usage Flow "For Candidates" section
- [x] 2.4 Verify the README renders correctly and links work

## 3. Update Component Documentation

- [x] 3.1 Add `VoiceAgentPage` section to `docs/COMPONENTS.md` under Page Components (describe its responsibilities, key state, and audio pipeline reuse)
- [x] 3.2 Update the component relationships diagram in `docs/COMPONENTS.md` to include `VoiceAgentPage`
- [x] 3.3 Verify diagram ASCII formatting is intact

## 4. Update Architecture Documentation

- [x] 4.1 Update voice engine references in `docs/ARCHITECTURE.md` to mention Supertonic alongside Kokoro/Piper
- [x] 4.2 Add a brief Voice Agent data-flow note in `docs/ARCHITECTURE.md` (if not already covered by the backend architecture doc reference)

## 5. Update Setup Guide

- [x] 5.1 Add `npm run pwa:assets` to the Frontend Scripts table in `docs/SETUP.md`
- [x] 5.2 Add Voice Agent (`/voice-agent`) to the verification checklist

## 6. Validation

- [x] 6.1 `npm run build` passes with no errors
- [x] 6.2 `npm run lint` passes (or only pre-existing warnings)
- [x] 6.3 Verify all Markdown files render correctly with no broken links
