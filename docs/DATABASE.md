# Database Documentation

## Technology

- **PostgreSQL** 15+ (required for `pgvector` extension)
- **ORM:** Drizzle ORM with `node-postgres` driver
- **Vector support:** `pgvector` extension for cosine similarity queries

## Connection

Database connection is configured in `src/lib/db.ts`:

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

**Environment variable:** `DATABASE_URL` — PostgreSQL connection string

## Schema

### `positions`

Job positions that candidates interview for.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default random |
| `title` | `text` | NOT NULL |
| `level` | `text` | NOT NULL (e.g., "Junior", "Senior", "Staff") |
| `jobDescription` | `text` | NULLABLE (full job description for context) |
| `requirements` | `text[]` | NOT NULL (array of requirement strings) |
| `createdAt` | `timestamp` | DEFAULT now(), NOT NULL |

### `candidates`

Interview candidates.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default random |
| `name` | `text` | NOT NULL |
| `email` | `text` | NOT NULL |
| `skills` | `text[]` | NOT NULL (array of skill strings) |
| `experienceYears` | `integer` | NULLABLE |
| `cv` | `text` | NULLABLE (full CV text, truncated to 800 chars in prompts) |
| `createdAt` | `timestamp` | DEFAULT now(), NOT NULL |

### `interviewSessions`

Individual interview sessions linking a candidate to a position.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default random |
| `positionId` | `uuid` | FK → positions.id, NOT NULL |
| `candidateId` | `uuid` | FK → candidates.id, NOT NULL |
| `status` | `text` | NOT NULL, DEFAULT "created" |
| `maxTurns` | `integer` | NOT NULL, DEFAULT 8 |
| `currentTurn` | `integer` | NOT NULL, DEFAULT 0 |
| `createdAt` | `timestamp` | DEFAULT now(), NOT NULL |
| `completedAt` | `timestamp` | NULLABLE |

**Status values:** `created`, `in_progress`, `completed`

### `messages`

Chat messages within an interview session.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default random |
| `sessionId` | `uuid` | FK → interviewSessions.id, NOT NULL |
| `role` | `text` | NOT NULL (`interviewer` or `candidate`) |
| `content` | `text` | NOT NULL |
| `createdAt` | `timestamp` | DEFAULT now(), NOT NULL |

### `embeddings`

Vector embeddings for semantic similarity search.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default random |
| `sourceType` | `text` | NOT NULL (`requirement` or `message`) |
| `sourceId` | `uuid` | NOT NULL |
| `sessionId` | `uuid` | NULLABLE (null for requirements, set for messages) |
| `content` | `text` | NOT NULL |
| `embedding` | `text` | NOT NULL (JSON string of float array) |
| `createdAt` | `timestamp` | DEFAULT now(), NOT NULL |

**Indexes:**
- `embeddings_source_idx` on `(sourceType, sourceId)`
- `embeddings_session_idx` on `(sessionId)`

**Note:** The `embedding` column stores a JSON string because Drizzle ORM doesn't natively support pgvector's `vector` type. Raw SQL queries cast it using `::vector(dimension)`.

**Dimension:** 1024 (matches `mxbai-embed-large` model)

### `campaigns`

Recruiting campaigns that group multiple positions together for seasonal or project-based hiring.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default random |
| `name` | `text` | NOT NULL |
| `description` | `text` | NULLABLE |
| `startDate` | `timestamp` | NULLABLE (with timezone) |
| `endDate` | `timestamp` | NULLABLE (with timezone) |
| `tags` | `text[]` | NOT NULL, DEFAULT `[]` |
| `status` | `text` | NOT NULL, DEFAULT `"draft"` |
| `createdAt` | `timestamp` | DEFAULT now(), NOT NULL |

**Status values:** `draft`, `active`, `archived`

### `campaign_positions`

Junction table linking campaigns to positions (many-to-many). Positions can belong to multiple campaigns.

| Column | Type | Constraints |
|--------|------|-------------|
| `campaignId` | `uuid` | FK → campaigns.id, ON DELETE CASCADE, NOT NULL |
| `positionId` | `uuid` | FK → positions.id, ON DELETE CASCADE, NOT NULL |
| `addedAt` | `timestamp` | DEFAULT now(), NOT NULL |

**Indexes:**
- `campaign_positions_campaign_idx` on `(campaignId)`
- `campaign_positions_position_idx` on `(positionId)`

### `evaluationVersions`

Post-interview AI-generated evaluations with human calibration support. Each evaluation creates a new version — existing versions are never overwritten.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default random |
| `sessionId` | `uuid` | FK → interviewSessions.id, ON DELETE CASCADE, NOT NULL |
| `model` | `text` | NOT NULL (model that generated this evaluation) |
| `rawResponse` | `text` | NOT NULL (full LLM response, even if parsing failed) |
| `aiTechnicalDepth` | `integer` | NULLABLE (1-5) |
| `aiCommunicationClarity` | `integer` | NULLABLE (1-5) |
| `aiProblemSolving` | `integer` | NULLABLE (1-5) |
| `aiRelevanceToRole` | `integer` | NULLABLE (1-5) |
| `aiRecommendation` | `text` | NULLABLE (`strong_yes`, `yes`, `maybe`, `no`, `strong_no`) |
| `aiConfidence` | `integer` | NULLABLE (0-100) |
| `humanTechnicalDepth` | `integer` | NULLABLE (1-5, human override) |
| `humanCommunicationClarity` | `integer` | NULLABLE (1-5, human override) |
| `humanProblemSolving` | `integer` | NULLABLE (1-5, human override) |
| `humanRelevanceToRole` | `integer` | NULLABLE (1-5, human override) |
| `humanRecommendation` | `text` | NULLABLE (human override recommendation) |
| `strengths` | `text[]` | NOT NULL, DEFAULT `[]` (from AI) |
| `weaknesses` | `text[]` | NOT NULL, DEFAULT `[]` (from AI) |
| `recruiterNotes` | `text` | NULLABLE |
| `humanCalibrated` | `boolean` | DEFAULT false |
| `createdAt` | `timestamp` | DEFAULT now(), NOT NULL |

**Indexes:**
- `evaluation_versions_session_idx` on `(sessionId)`
- `evaluation_versions_created_idx` on `(createdAt)`

## Migrations

Migrations are managed with Drizzle Kit. Migration files live in `migrations/`.

### Running Migrations

```bash
# Apply pending migrations
npx drizzle-kit migrate

# Generate a new migration from schema changes
npx drizzle-kit generate
```

### Migration Files

```
migrations/
├── 0000_initial.sql                    # Initial schema
├── 0001_add_cv.sql                     # Added cv column to candidates
├── 0002_add_embeddings.sql             # Added embeddings table
├── 0003_add_evaluations.sql            # Added evaluations table
├── 0004_add_evaluation_versions.sql    # Added evaluation_versions table
├── 0005_migrate_evaluations.sql        # Migrated evaluations → evaluationVersions
└── meta/
    ├── _journal.json                   # Migration history
    └── 0000_snapshot.json              # Schema snapshots
```

## Vector Similarity Queries

The `embeddings` table supports cosine similarity search via raw SQL:

```sql
-- Find how closely a message matches a requirement
SELECT
  r.content AS requirement,
  MIN(r.embedding::vector(1024) <=> m.embedding::vector(1024)) AS distance
FROM embeddings r
LEFT JOIN embeddings m
  ON m.source_type = 'message'
  AND m.session_id = 'session-uuid'
WHERE r.source_type = 'requirement'
  AND r.source_id = 'position-uuid'
GROUP BY r.id, r.content, r.embedding;
```

**Distance interpretation:**
- Cosine distance ranges from 0 (identical) to 2 (opposite)
- Default threshold: 0.25 distance = 0.75 similarity
- Configurable via `EMBEDDING_SIMILARITY_THRESHOLD` env var

## Seeding

Run the seed script to create sample data:

```bash
npx tsx src/lib/seed.ts
```

This creates:
- **Position:** Senior Full Stack Engineer (React, Node.js, PostgreSQL, TypeScript, System Design)
- **Candidate:** Jane Doe (React, Node.js, Python, AWS, 5 years, with CV)

## Backup Recommendations

For production use:

```bash
# Standard PostgreSQL backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```
