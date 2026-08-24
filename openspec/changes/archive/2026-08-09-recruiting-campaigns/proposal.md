# Recruiting Campaigns with Reporting — Proposal

## Problem

Right now, every position and interview session is an island. A recruiter running a "Summer 2026 Engineering Push" has no way to group multiple positions together, track progress toward hiring goals, or see aggregated reports across related roles. They must mentally connect "Senior React Dev" and "Staff Backend Engineer" as part of the same initiative.

Pain points:
1. **No initiative grouping** — 8 open positions feel like 8 separate tasks, not one coordinated hiring push
2. **No progress tracking** — Can't see "we've interviewed 38 candidates for the summer push, with 5 strong-yes so far"
3. **No cross-position analytics** — Dashboard shows global averages, not campaign-specific insights
4. **Seasonal context is lost** — Was this candidate evaluated during the urgent summer push or the regular fall cycle?

## Solution

Add **campaigns** as flexible containers that group positions and their sessions. Each campaign has optional dates, free-form tags, and a status lifecycle. A junction table allows positions to participate in multiple campaigns over time. A campaign detail page shows a report table with aggregated metrics and top candidates.

## Scope

**In scope:**
- `campaigns` table: id, name, description, startDate, endDate, tags[], status (draft | active | paused | closed), createdAt
- `campaign_positions` junction table: campaignId, positionId, addedAt
- API: `GET/POST /api/campaigns`, `GET/PATCH/DELETE /api/campaigns/:id`, `POST/DELETE /api/campaigns/:id/positions`
- Campaign list page (`/campaigns`) with status badges, date ranges, and session counts
- Campaign creation form with position multi-select
- Campaign detail page (`/campaigns/:id`) showing:
  - Assigned positions with session counts
  - Report table: total sessions, completion rate, avg AI/human scores, recommendation distribution
  - Top candidates table across all campaign positions
- Dashboard filter by campaign (optional, if straightforward)

**Out of scope:**
- Charts and visualizations (bar charts, score distributions)
- Report export (PDF, CSV)
- Automated campaign status transitions (e.g., auto-close when endDate passes)
- Candidate-level campaign analytics ("Jane applied to 3 campaigns")
- ATS integration or external campaign import

## Non-goals
- Hardcoded seasons or quarters — dates are fully flexible
- Position exclusivity — one position can belong to multiple campaigns
- Campaign-level interviewer configuration (different models per campaign)
- Budget or cost tracking per campaign

## Data Model

```
campaigns
├── id: uuid (PK)
├── name: text (not null)
├── description: text
├── startDate: date (nullable)
├── endDate: date (nullable)
├── tags: text[] (default [])
├── status: text (default "draft")
└── createdAt: timestamp

campaign_positions
├── campaignId: uuid (FK → campaigns.id, onDelete cascade)
├── positionId: uuid (FK → positions.id, onDelete cascade)
└── addedAt: timestamp
```

Junction table allows many-to-many: a campaign has many positions, a position can be in many campaigns.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Campaign detail page queries become expensive with many sessions | Use `count()` aggregations, not full row loads; add indexes on `campaign_positions.campaignId` |
| Recruiters create empty campaigns and forget them | Default status is `draft`; show draft count in list; allow bulk status updates (future) |
| Position reuse across campaigns creates confusion | Show "In N campaigns" badge on position list; campaign detail shows which positions are shared |
| Report table is too wide on mobile | Stack metrics vertically below `md:` breakpoint; use horizontal scroll as fallback |

## Success Criteria

- Recruiter can create a campaign with name, dates, tags, and selected positions
- Campaign list shows status, date range, and total session count
- Campaign detail shows per-position session counts and aggregated report metrics
- Top candidates table sorts by human score (or AI score if no human override)
- A position can be added to multiple campaigns without error
- Removing a position from a campaign does not delete the position or its sessions
- Build passes, lint passes
