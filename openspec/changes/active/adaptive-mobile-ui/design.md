# Design: Make Web UI Mobile Adaptive

## Overview

This change improves the mobile experience of the Next.js frontend using Tailwind CSS responsive utilities. Desktop layouts remain unchanged. The goal is to eliminate horizontal overflow, increase touch targets, and make candidate-facing interview pages comfortable on phones.

## Pages and Components to Update

```
RootLayout
└── Navigation (mobile hamburger + desktop links)

Admin list pages
├── DashboardPage        → table on md+, card list below
├── PositionsPage        → table on md+, card list below
├── CandidatesPage       → table on md+, card list below
├── CampaignsPage        → table on md+, card list below
├── CampaignDetailPage   → responsive metrics + card lists for tables
└── ComparePage          → stacked comparison cards on mobile

Interview pages
├── InterviewPage        → larger input/button, no iOS zoom
├── VoiceInterviewPage   → stacked header, larger recorder target
└── TranscriptPage       → larger Speak/Stop touch targets

Forms
├── SetupPage / SetupForm
└── PositionForm / CandidateForm / CampaignForm
```

## Responsive Patterns

We will use Tailwind's default breakpoints:

- `sm:` — 640px and up
- `md:` — 768px and up
- `lg:` — 1024px and up

### Pattern A: Table → Card list

Desktop keeps the existing `<table>`. Mobile hides the table and renders a vertical card list with the same data.

```tsx
<div className="hidden md:block">{/* desktop table */}</div>
<div className="space-y-3 md:hidden">{/* mobile cards */}</div>
```

### Pattern B: Padding reduction

Replace blanket `p-6` with responsive padding:

```tsx
<div className="p-4 md:p-6">
```

### Pattern C: Touch target sizing

Minimum tap target of 44×44px. For text-like actions we add padding; for buttons we ensure `min-h-[44px]` or larger.

## Component-by-Component Design

### 1. Navigation (`src/app/layout.tsx`)

Current: horizontal link row inside `max-w-5xl`.

New:
- Desktop (`md+`): keep horizontal links as-is.
- Mobile: hide links behind a hamburger button; clicking opens a vertical menu overlay.
- The hamburger state lives in a small client component so `layout.tsx` can stay mostly server-rendered.

Implementation: create `src/components/MobileNav.tsx` (client component) with menu open/close state and render it inside `RootLayout`. Desktop links remain inline.

### 2. Dashboard (`src/app/dashboard/page.tsx`)

Current: 4-column stats grid + filters row + 7-column table.

New:
- Stats grid: keep `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
- Filters: stack vertically on mobile; keep horizontal on `sm+`.
- Session table: replace with mobile cards below `md`.

Mobile card fields:
- Candidate name + email
- Position title + level
- Status and mode badges
- Turns
- AI score + human score if calibrated
- Recommendation + calibrated check
- Actions: Copy Link, Join Voice (if applicable), View

### 3. Positions, Candidates, Campaigns list pages

Same table → card pattern. Each card shows the most important 4–6 fields and a clear primary action.

### 4. Campaign detail (`src/app/campaigns/[id]/page.tsx`)

Current: metric cards + recommendation bars + two tables (top candidates, positions).

New:
- Metric grid: keep `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`.
- Recommendation bars: keep as-is; labels may wrap.
- Tables: convert to card lists below `md`.

### 5. Compare (`src/app/compare/page.tsx`)

Current: comparison table with one candidate per column.

New:
- Desktop (`md+`): keep table.
- Mobile: render each candidate as a full-width card with all metrics listed vertically.

### 6. Interview chat (`src/app/interview/[id]/page.tsx`)

Current: `max-w-2xl`, input + send button row.

New:
- Keep single-column layout; it's already mobile-friendly.
- Reduce outer padding on mobile.
- Increase input font size to `text-base` to prevent iOS zoom.
- Make send button taller (`min-h-[44px]`).

### 7. Voice interview (`src/app/interview/[id]/voice/page.tsx`)

Current: header crams title + streaming toggle + playback rate + turn counter in one row.

New:
- Mobile: stack header content vertically.
- Make playback-rate select and toggle buttons larger.
- Increase `AudioRecorder` touch target and waveform display area.

### 8. Transcript (`src/app/interview/[id]/transcript/page.tsx`)

Current: per-message playback-rate `<select>` + Speak/Stop button are very small (`text-xs px-2 py-0.5`).

New:
- Increase select and button size to at least 44px tall.
- Use larger text or icon-only button with padding for Speak/Stop.

### 9. Setup and forms

- Reduce page padding on mobile.
- Increase inputs/selects to `text-base` to prevent iOS zoom.
- Make mode/engine selection buttons taller.

## Avoided Approaches

- **Horizontal-scrolling nav**: rejected because it still hides items and isn't accessible.
- **Always card lists**: rejected because recruiters benefit from dense tables on desktop.
- **New CSS-in-JS or styled-components**: rejected; use Tailwind only.

## Dependencies

No new dependencies.

## Documentation Updates

- `docs/COMPONENTS.md` — add `MobileNav` component docs; update page component notes.
- `docs/CHANGELOG.md` — dated entry for this change.

## Manual Validation Plan

1. Open each updated page in Chrome DevTools responsive mode at 375px and 768px.
2. Confirm no horizontal scrollbars.
3. Tap through mobile nav, dashboard cards, interview input, transcript Speak/Stop, and voice recorder.
4. Test iOS input zoom by checking that focusing inputs does not zoom the page.
5. Verify dark mode still works on mobile.
