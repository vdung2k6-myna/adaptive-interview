# Recruiting Campaigns with Reporting — Tasks

## Database

- [x] Add `campaigns` table to `src/lib/schema.ts`
- [x] Add `campaign_positions` junction table to `src/lib/schema.ts`
- [x] Generate Drizzle migration with `npx drizzle-kit generate`
- [x] Apply migration to local database

## API Layer

- [x] Create `POST /api/campaigns/route.ts` — create campaign with name, description, dates, tags, status
- [x] Create `GET /api/campaigns/route.ts` — list campaigns with session counts
- [x] Create `GET /api/campaigns/[id]/route.ts` — fetch single campaign with positions and report metrics
- [x] Create `PATCH /api/campaigns/[id]/route.ts` — update campaign fields
- [x] Create `DELETE /api/campaigns/[id]/route.ts` — delete campaign (cascade removes junction rows, not positions)
- [x] Create `POST /api/campaigns/[id]/positions/route.ts` — add position to campaign
- [x] Create `DELETE /api/campaigns/[id]/positions/route.ts` — remove position from campaign

## Campaign UI

- [x] Create `/app/campaigns/page.tsx` — list table with status badges, dates, tags, session count, actions
- [x] Create `/app/campaigns/[id]/page.tsx` — detail page with positions list and report metrics
- [x] Create campaign creation form component — name, description, dates, tags input, position multi-select
- [x] Create `/app/campaigns/new/page.tsx` — creation page wrapping the form

## Report Section (within campaign detail)

- [x] Add aggregated metrics: total sessions, completed count, completion rate, avg AI score, avg human score
- [x] Add recommendation distribution counts (strong_yes, yes, maybe, no, strong_no)
- [x] Add top candidates table sorted by human score → AI score fallback

## Navigation & Integration

- [x] Add "Campaigns" link to top nav bar in `layout.tsx`
- [x] Show campaign badge/indicator on dashboard sessions (optional)
- [x] Show "In N campaigns" badge on `/positions` list page

## Documentation

- [x] Update `docs/API.md` with campaign endpoints
- [x] Update `docs/ARCHITECTURE.md` with new tables and pages
- [x] Update `docs/DATABASE.md` with new schema
- [x] Update `docs/COMPONENTS.md` with new form components
- [x] Update `docs/CHANGELOG.md` with entry

## Validation

- [x] `npm run build` passes
- [x] `npm run lint` passes
- [x] Create campaign → appears in list
- [x] Add position to campaign → campaign detail shows position and sessions
- [x] Remove position from campaign → position removed from campaign, not deleted
- [x] Delete campaign → junction rows cleaned up, positions and sessions remain
- [x] Same position in two campaigns → both show correct metrics independently
