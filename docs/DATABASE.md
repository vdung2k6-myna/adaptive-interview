# Database Documentation

## Important

The Next.js frontend (`adaptive-interview`) has **no database connection**. All database access happens in the standalone Express backend (`adaptive-interview-api`).

This document describes the database from the frontend's point of view: what data exists, how the frontend references it, and where the actual schema/migrations live.

## Technology

- **PostgreSQL** 15+ with `pgvector` extension
- **ORM:** Drizzle ORM with `node-postgres` driver
- **Vector support:** `pgvector` extension for cosine similarity queries

These are configured and used only in the backend. See [adaptive-interview-api/docs/ARCHITECTURE.md](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/ARCHITECTURE.md) and [adaptive-interview-api/docs/SETUP.md](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/SETUP.md) for backend DB details.

## Schema

The database schema lives in the backend. The tables are:

| Table | Purpose |
|-------|---------|
| `positions` | Job positions |
| `candidates` | Interview candidates |
| `interviewSessions` | Interview sessions linking candidates to positions |
| `messages` | Chat messages within a session |
| `embeddings` | Vector embeddings for semantic topic tracking |
| `campaigns` | Recruiting campaigns |
| `campaign_positions` | Many-to-many campaign â†” position junction |
| `evaluationVersions` | Post-interview AI evaluations + human calibration |

For full column definitions, indexes, and migration files, see the backend documentation.

## Frontend Types

Because the frontend no longer imports Drizzle schema types, it uses lightweight interfaces in `src/lib/types.ts`:

```typescript
export interface Position {
  id: string;
  title: string;
  level: string;
  jobDescription?: string | null;
  requirements: string[];
  createdAt: string;
  sessionCount?: number;
}
```

These are shaped to match the JSON returned by the backend API.

## Data Access

The frontend loads data via `apiFetch()` from `@/lib/api-client`. There are no server-side database queries in the frontend. All list pages (`/candidates`, `/positions`, `/campaigns`, `/setup`, `/dashboard`) are Client Components that fetch from the backend at runtime.

```
Frontend Client Component
    â”‚
    â–¼
apiFetch("/api/positions")
    â”‚
    â–¼
Next.js dev proxy /api/* â†’ :4000
    â”‚
    â–¼
Express backend (Drizzle + PostgreSQL)
```

## Migrations

Migration files live in the backend repository (`adaptive-interview-api/migrations/`). They are applied with:

```bash
cd adaptive-interview-api
npx drizzle-kit migrate
```

Never run `npx drizzle-kit migrate` from the frontend repository â€” it has no schema or database connection.

## Seeding

The seed script lives in the backend:

```bash
cd adaptive-interview-api
npx tsx src/lib/seed.ts
```

## Vector Search

Semantic similarity queries over the `embeddings` table are implemented in `adaptive-interview-api/src/lib/embeddings.ts`. The frontend has no vector search logic.

## Backup Recommendations

Backups are standard PostgreSQL operations against the database the backend uses:

```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```
