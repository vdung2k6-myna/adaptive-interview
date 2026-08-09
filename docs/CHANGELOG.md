# Changelog

## 2026-08-09

### Job Description on Positions

**Change:** `job-description-on-positions`

**Problem:** Interview questions and evaluations only knew the position title, level, and requirements. There was no way to provide broader context about the role, team, or responsibilities.

**Solution:** Added an optional `jobDescription` text field to positions. It is included in the interviewer prompt and evaluation prompt when present, giving the AI richer context for question generation and scoring.

**What changed:**
- Database:
  - Added `job_description` column to `positions` table (nullable text)
  - Generated migration `migrations/0005_salty_loners.sql`
- API:
  - `POST /api/positions` — accepts optional `jobDescription`
  - `PATCH /api/positions/:id` — accepts optional `jobDescription`
  - `GET /api/positions/:id` — returns `jobDescription`
  - `GET /api/sessions` — returns `jobDescription` in position object
- AI Prompts:
  - `buildPrompt()` in `src/lib/prompts.ts` — includes job description under "Position" section when present
  - `buildEvaluationPrompt()` in `src/lib/evaluation.ts` — includes job description when present
  - `POST /api/messages` — passes `jobDescription` to `buildPrompt()`
- UI:
  - `PositionForm` — added textarea for job description
  - `/positions` list page — added "Description" column with truncated text
  - `/positions/[id]/edit` — passes `jobDescription` to form
- Documentation:
  - Updated `docs/API.md`, `docs/DATABASE.md`, `docs/COMPONENTS.md`

**Status:** Implemented and documented.

---

## 2026-08-09

### Recruiting Campaigns with Reporting

**Change:** `recruiting-campaigns` (OpenSpec)

**Problem:** No way to group positions into seasonal or project-based hiring campaigns, or view aggregated metrics across multiple positions.

**Solution:** Added flexible campaigns that group positions with optional dates, tags, and status. Campaign detail pages show aggregated report metrics (sessions, completion rate, scores, recommendations, top candidates).

**What changed:**
- Database:
  - Added `campaigns` table with name, description, optional dates, tags, and status
  - Added `campaign_positions` junction table for many-to-many relationship
  - Generated migration `migrations/0004_aromatic_orphan.sql`
- API:
  - `POST /api/campaigns` — create campaign, optionally assign positions via `positionIds`
  - `GET /api/campaigns` — list campaigns with `positionCount` and `sessionCount`
  - `GET /api/campaigns/:id` — fetch campaign with positions and full report
  - `PATCH /api/campaigns/:id` — update campaign fields
  - `DELETE /api/campaigns/:id` — delete campaign (cascades junction rows)
  - `POST /api/campaigns/:id/positions` — add position to campaign
  - `DELETE /api/campaigns/:id/positions?positionId=...` — remove position from campaign
- UI:
  - New `/campaigns` page — list table with status, dates, position/session counts
  - New `/campaigns/new` page — creation form with position multi-select
  - New `/campaigns/[id]` page — detail with metrics cards, recommendation distribution, top candidates table, and position list
  - Updated `DeleteButton` to support `type="campaign"`
  - Updated nav bar with "Campaigns" link
- Documentation:
  - Updated `docs/API.md`, `docs/DATABASE.md`, `docs/ARCHITECTURE.md`, `docs/COMPONENTS.md`

**Status:** Implemented and documented.

---

## 2026-08-09

### Edit/Delete Positions and Candidates

**Change:** `edit-delete-positions-candidates` (OpenSpec)

**Problem:** Positions and candidates were immutable after creation. Recruiters couldn't fix typos, update CVs, or remove test entries.

**Solution:** Added edit and delete capabilities for positions and candidates, restricted to entities with no associated interview sessions (Direction D).

**What changed:**
- API:
  - `GET /api/positions/:id` — fetch single position
  - `PATCH /api/positions/:id` — update fields, regenerate embeddings if requirements changed, blocked by 409 if referenced
  - `DELETE /api/positions/:id` — delete if unused, blocked by 409 if referenced
  - `GET /api/candidates/:id` — fetch single candidate
  - `PATCH /api/candidates/:id` — update fields, blocked by 409 if referenced
  - `DELETE /api/candidates/:id` — delete if unused, blocked by 409 if referenced
- UI:
  - New `/positions` page — list table with Edit/Delete actions, "in use" session count
  - New `/candidates` page — list table with Edit/Delete actions, "in use" session count
  - Extended `PositionForm` with `initialData` prop for edit mode (`PATCH` instead of `POST`)
  - Extended `CandidateForm` with `initialData` prop for edit mode
  - Created `/positions/[id]/edit/page.tsx` and `/candidates/[id]/edit/page.tsx`
  - New `DeleteButton` component with confirmation dialog
  - Updated nav bar: replaced "+ Position" / "+ Candidate" with "Positions" / "Candidates" links
  - Updated `/setup` to show "Edit" links below dropdowns for unused entities

**Status:** Implemented and documented.

---

## 2026-08-09

### Dev Server Port Convenience Scripts

**Change:** `dev-port-scripts`

**What changed:**
- Added `dev:3001` and `dev:4000` scripts to `package.json` for quick port switching
- Updated `README.md` and `docs/SETUP.md` with the new commands

**Status:** Implemented.

---

## 2026-08-09

### Fix: Static Chunk Loading in Standalone Build

**Change:** `standalone-static-postbuild`

**Problem:** Next.js `output: "standalone"` does not copy `.next/static/` (JS/CSS chunks) into the standalone directory. Running `node .next/standalone/server.js` caused `Failed to load chunk` errors in the browser.

**Solution:** Added a `postbuild` script that copies `.next/static` → `.next/standalone/.next/static` after every build.

**What changed:**
- Created `scripts/postbuild.mjs` — copies static chunks into the standalone output directory
- Updated `package.json`:
  - Added `"postbuild": "node scripts/postbuild.mjs"` (runs automatically after `npm run build`)
  - Updated `"start": "node .next/standalone/server.js"` (was `next start`, which doesn't work with standalone)
- Updated `docs/SETUP.md` and `README.md` — corrected production start instructions

**Status:** Implemented and documented.

---

## 2026-08-09

### Copy Interview Link

**Change:** `copy-interview-link`

**Problem:** Recruiters had no way to retrieve the candidate-facing interview URL after creating a session.

**Solution:** Added "Copy Interview Link" buttons to the Dashboard and Transcript pages.

**What changed:**
- `src/app/dashboard/page.tsx` — Added `Copy Link` button in the Actions column of the session table. Shows "Copied!" for 2 seconds after clicking.
- `src/app/interview/[id]/transcript/page.tsx` — Added "Copy Interview Link" button in the transcript header. Shows "✓ Link Copied" for 2 seconds after clicking.
- Both use `navigator.clipboard.writeText()` with a fallback to `document.execCommand("copy")` for older browsers.

**Status:** Implemented and documented.

---

## 2026-08-09

### Environment-Specific Configuration

**Change:** `env-config-layer`

**Problem:** Timeouts, DB pool sizes, and retry counts were hardcoded. Dev machines and production deploys need different tuning.

**Solution:** Centralized config layer in `src/lib/config/` with per-environment files. Production build uses Next.js `output: "standalone"` for a self-contained deployable bundle.

**What changed:**
- Created `src/lib/config/index.ts` — exports active config based on `NODE_ENV`
- Created `src/lib/config/development.ts` — small pool (5), 60s chat timeout, 1 retry
- Created `src/lib/config/production.ts` — large pool (20), 120s chat timeout, 2 retries
- Updated `next.config.ts` with `output: "standalone"`, `compress: true`, and `productionBrowserSourceMaps: false`
- Updated `src/lib/db.ts` — uses `config.database.poolSize` for `Pool.max`
- Updated `src/lib/ollama.ts` — uses config for base URL, model names, timeouts, and error messages
- Updated `src/lib/evaluation.ts` — uses config for temperature and max retry attempts
- Removed unused `delay()` function from `src/lib/ollama.ts`
- Updated `README.md`, `SETUP.md` — corrected production start command to `node .next/standalone/server.js` (not `npm start`)

**Status:** Implemented and documented.

---

## 2026-08-08

### Evaluation Calibration (Implemented)

**Change:** `evaluation-calibration` (OpenSpec, archived)

**Problem:** AI evaluation scores are inconsistent across models and runs. Recruiters cannot trust or override scores. No history of re-evaluations.

**Solution:**
- Added `evaluationVersions` table with `ai_*` and `human_*` score columns
- Created `ScoreInput`, `ModelBadge`, and `VersionHistory` components
- Updated transcript page with human override, model selector, and version history
- Updated dashboard to show AI + human scores and calibration indicator
- Updated compare page to show model badge and handle new API shape
- Added `GET /api/evaluations/versions/:versionId` for historical version viewing

**What changed:**
- `src/lib/schema.ts` — Added `evaluationVersions` table with human calibration fields
- `src/lib/evaluation.ts` — Generates new versions (never overwrites)
- `src/app/api/evaluations/[sessionId]/route.ts` — Returns `{latest, versions}` with nested score objects
- `src/app/api/evaluations/versions/[versionId]/route.ts` — Added GET for version viewing, existing DELETE
- `src/app/api/sessions/[id]/evaluate/route.ts` — Accepts optional `{model}` in body
- `src/app/api/sessions/route.ts` — Uses evaluationVersions, returns `humanOverallScore` + `humanCalibrated`
- `src/app/interview/[id]/transcript/page.tsx` — Full calibration UI with historical viewing
- `src/app/dashboard/page.tsx` — Shows human score and calibration indicator
- `src/app/compare/page.tsx` — Shows model badge, uses `aiScores` nested fields
- `src/components/ScoreInput.tsx` (new) — Interactive star score input
- `src/components/ModelBadge.tsx` (new) — Model name badge
- `src/components/VersionHistory.tsx` (new) — Version list with select/delete
- `migrations/0004_add_evaluation_versions.sql` (new) — Creates evaluationVersions table
- `migrations/0005_migrate_evaluations.sql` (new) — Migrates old evaluations

**Status:** Implemented and documented.

---

### Rich LLM Chat Output

**Change:** `rich-llm-chat-output` (OpenSpec)

**Problem:** LLM text output was rendered as raw plain text. When the model used Markdown formatting (bold text, bullet lists, code blocks), candidates saw literal asterisks and backticks.

**Solution:** Parse Markdown with `marked`, syntax-highlight code blocks with `highlight.js`, and safely render HTML with `DOMPurify`.

**What changed:**
- Added `MarkdownRenderer` component with tree-shaken `highlight.js` (9 languages)
- Added custom CSS for dark code blocks, inline code, lists, tables, and syntax tokens
- Updated interview page to render interviewer messages as rich Markdown
- Updated transcript page with identical rich formatting
- Updated interviewer prompt to encourage Markdown formatting and language hints
- Added performance optimizations:
  - Batch React state updates during streaming (~50ms intervals)
  - `React.memo` on `MarkdownRenderer`
  - Extracted `MessageBubble` component with `React.memo`

**Files touched:**
- `src/components/MarkdownRenderer.tsx` (new)
- `src/app/globals.css` (added Markdown + hljs styles)
- `src/app/interview/[id]/page.tsx` (rich rendering + performance)
- `src/app/interview/[id]/transcript/page.tsx` (rich rendering)
- `src/lib/prompts.ts` (added Markdown hint)
- `package.json` (added `highlight.js`, `dompurify`)

**Performance impact:**
- React re-renders during streaming: ~100/sec → ~20/sec
- Completed messages now skip React's render phase entirely
- Markdown parsing reduced by ~5-10×

---

### Recruiter Dashboard with AI Evaluation

**Change:** `recruiter-dashboard-with-ai-eval` (OpenSpec, archived)

**Problem:** No centralized view for recruiters to review interview results.

**Solution:** Built dashboard with session list, status filters, search, and side-by-side candidate comparison with star ratings.

**What changed:**
- Created `/dashboard` page with stats cards and session table
- Created `/compare` page for side-by-side evaluation comparison
- Added `overallScore` and `recommendation` to session API response
- Added color-coded status and recommendation badges

---

### Real-Time Ollama Streaming

**Change:** `real-time-ollama-streaming` (OpenSpec, archived)

**Problem:** Interview questions appeared all at once after a long delay. Users saw only a bouncing-dots loader.

**Solution:** Switched from `stream: false` to `stream: true`, piped tokens through a Next.js `ReadableStream`, and rendered them incrementally.

**What changed:**
- Added `generateChatResponseStream()` in `src/lib/ollama.ts`
- Updated `POST /api/messages` to return `ReadableStream`
- Updated interview page with `consumeStream()` function
- Added loading dots animation during streaming

---

### Semantic Topic Tracking

**Change:** `semantic-topic-tracking` (OpenSpec, archived)

**Problem:** Interviewer asked about the same topics repeatedly or skipped important requirements.

**Solution:** Added vector embeddings to track which position requirements have been covered by the conversation.

**What changed:**
- Created `embeddings` table with pgvector support
- Added `storeRequirementEmbedding()` and `storeMessageEmbedding()`
- Added `getRequirementCoverage()` for cosine similarity queries
- Updated `buildPrompt()` to include covered and remaining topics

---

### Adaptive Interview Engine (Initial)

**Change:** `adaptive-interview-engine` (OpenSpec, archived)

**Problem:** Static interview questions that don't adapt to the candidate.

**Solution:** AI-generated questions that consider candidate skills, experience, CV, and position requirements.

**What changed:**
- Created core data model (positions, candidates, sessions, messages)
- Built `buildPrompt()` for context-aware question generation
- Created turn-based interview flow with max turn limit
- Added setup page for selecting position + candidate

---

## 2026-08-07 (Earlier)

### Vector Search

Added pgvector extension and embeddings table for semantic similarity search.

### AI Interview

Initial implementation of AI-powered interviewer using Ollama.

### OpenSpec Integration

Added OpenSpec framework for managing changes.

---

## Decisions Log

| Date | Decision | Context |
|------|----------|---------|
| 2026-08-08 | Always-dark code blocks | Dark code blocks look intentional in both light/dark app modes. Simplifies theming significantly. |
| 2026-08-08 | No `system` role for prompts | Some cloud Ollama models reject `system` messages. Using `user` role for context ensures compatibility. |
| 2026-08-08 | Batch streaming at 50ms | Trade-off between responsiveness and CPU usage. 50ms feels smooth while reducing re-renders by ~5×. |
| 2026-08-08 | Tree-shake highlight.js | Import only 9 languages (~30KB) vs full bundle (~300KB). Covers 95% of technical interview topics. |
| 2026-08-07 | Use `text` for embeddings | Drizzle doesn't support pgvector's `vector` type. Store as JSON string, cast in raw SQL queries. |
| 2026-08-07 | No auth for MVP | Interviews are accessed via unguessable UUID URLs. Authentication deferred to post-MVP. |

---

## Migration Notes

### Adding `cv` column to candidates

```bash
psql $DATABASE_URL -f migrations/0001_add_cv.sql
```

### Adding embeddings table

```bash
# Ensure pgvector extension is enabled
psql ai_interview -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Apply migration
psql $DATABASE_URL -f migrations/0002_add_embeddings.sql
```

### Adding evaluations table

```bash
psql $DATABASE_URL -f migrations/0003_add_evaluations.sql
```

### Adding evaluation versions table

```bash
psql $DATABASE_URL -f migrations/0004_add_evaluation_versions.sql
```

### Migrating evaluations to evaluationVersions

```bash
psql $DATABASE_URL -f migrations/0005_migrate_evaluations.sql
```

### Adding job_description to positions

```bash
psql $DATABASE_URL -f migrations/0005_salty_loners.sql
```

### Adding campaigns and campaign_positions tables

```bash
psql $DATABASE_URL -f migrations/0004_aromatic_orphan.sql
```
