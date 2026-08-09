# Development Setup Guide

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **PostgreSQL** 15+ with `pgvector` extension
- **Ollama** (local) or access to a remote Ollama endpoint
- **npm** or **yarn**

## 1. Clone and Install

```bash
git clone <repository-url>
cd ollama-chat-react
npm install
```

## 2. Configure Environment

Create `.env.local` in the project root:

```bash
# Database (required)
DATABASE_URL=postgresql://user:password@localhost:5432/ai_interview

# Ollama (required)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
OLLAMA_EMBED_MODEL=mxbai-embed-large

# Optional: Embedding similarity threshold (default: 0.75)
# EMBEDDING_SIMILARITY_THRESHOLD=0.75

# Supabase (only if using Supabase for auth/storage - currently unused)
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 3. Set Up PostgreSQL

### Install PostgreSQL and pgvector

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew install pgvector
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-15
sudo apt-get install postgresql-15-pgvector
```

**Windows:**
Download and install PostgreSQL 15+ from the official installer. The `pgvector` extension may need manual installation.

### Create Database

```bash
createdb ai_interview
```

### Enable pgvector Extension

```bash
psql ai_interview -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

## 4. Run Database Migrations

```bash
npx drizzle-kit migrate
```

Or manually apply SQL files:

```bash
psql $DATABASE_URL -f migrations/0000_initial.sql
# Apply any subsequent migrations as needed
```

## 5. Seed Sample Data

```bash
npx tsx src/lib/seed.ts
```

This creates:
- **Position:** Senior Full Stack Engineer
- **Candidate:** Jane Doe (with skills and CV)

## 6. Set Up Ollama

### Install Ollama

Download from [ollama.com](https://ollama.com) or use the CLI:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Pull Required Models

```bash
# Chat model (for interview questions)
ollama pull llama3.1

# Embedding model (for vector search)
ollama pull mxbai-embed-large
```

### Verify Ollama is Running

```bash
ollama list
# Should show llama3.1 and mxbai-embed-large
```

Test the API:

```bash
curl http://localhost:11434/api/tags
```

## 7. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Production Configuration

For production deployments, create `.env.production` in the project root. Next.js automatically loads it when `NODE_ENV=production` (i.e. after `npm run build` → `npm start`):

```bash
# .env.production
DATABASE_URL=postgresql://prod_user:prod_pass@prod-db-host:5432/ai_interview
OLLAMA_BASE_URL=http://prod-ollama-host:11434
OLLAMA_MODEL=llama3.1
OLLAMA_EMBED_MODEL=mxbai-embed-large
```

Alternatively, set environment variables directly on your host (Docker, PM2, etc.) — they take precedence over `.env` files.

### Config Files

Environment-specific tuning lives in `src/lib/config/`:

| File | Purpose |
|---|---|
| `src/lib/config/index.ts` | Exports the active config based on `NODE_ENV` |
| `src/lib/config/development.ts` | Dev defaults: small DB pool (5), shorter timeouts (60s), 1 retry |
| `src/lib/config/production.ts` | Prod defaults: larger DB pool (20), longer timeouts (120s), 2 retries |

Values in these files can be overridden via environment variables (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`, etc.).

## 8. Verify Everything Works

1. **Dashboard** should load at `/dashboard`
2. **Create a position** at `/positions/new`
3. **Create a candidate** at `/candidates/new`
4. **Start an interview** at `/setup`
5. **Verify streaming** — interviewer messages should appear word-by-word
6. **Verify Markdown rendering** — bold text, lists, code blocks should render correctly
7. **Complete the interview** — after max turns, evaluation button should appear

## Troubleshooting

### Ollama Connection Refused

**Symptom:** `OllamaError: fetch failed`

**Fix:**
```bash
# Check if Ollama is running
ollama ps

# Start Ollama service
ollama serve
```

### Database Connection Error

**Symptom:** `Error: connect ECONNREFUSED`

**Fix:**
```bash
# Check PostgreSQL is running
pg_isready

# Start PostgreSQL
brew services start postgresql@15  # macOS
sudo service postgresql start       # Linux
```

### pgvector Extension Not Found

**Symptom:** `ERROR: extension "vector" does not exist`

**Fix:**
```bash
# Install pgvector (if not already installed)
# Then enable in your database:
psql ai_interview -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Model Returns Empty Content

**Symptom:** Interviewer messages are blank

**Fix:**
- Try a different model: `OLLAMA_MODEL=mistral`
- Check Ollama logs: `ollama logs`
- Some cloud models need warmup time — wait 10-30 seconds for first response

### Streaming Not Working

**Symptom:** Messages appear all at once instead of word-by-word

**Fix:**
- Check browser DevTools Network tab — look for NDJSON stream
- Verify `stream: true` is set in the Ollama request
- Some reverse proxies buffer responses — ensure yours doesn't

## Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 3000) |
| `npm run dev:3001` | Start dev server on port 3001 |
| `npm run dev:4000` | Start dev server on port 4000 |
| `npm run build` | Production build (outputs `.next/standalone/`) |
| `npm start` | Start production server from standalone bundle |
| `npm run lint` | ESLint check |
| `npx drizzle-kit migrate` | Apply database migrations |
| `npx drizzle-kit generate` | Generate migration from schema changes |
| `npx tsx src/lib/seed.ts` | Seed database with sample data |

> **Tip:** To use any port: `npx next dev -p {port}` or `PORT={port} npm run dev`.

## Production Deployment

Because `next.config.ts` sets `output: "standalone"`, the build produces a self-contained server bundle.

### Build

```bash
npm run build
```

After the build completes, `npm run postbuild` runs automatically and copies `.next/static/` into `.next/standalone/.next/static/`. This is required — Next.js standalone mode does not copy static chunks by default, and without this step you will see `Failed to load chunk` errors in the browser.

### Start the standalone server

```bash
npm start
# or directly:
node .next/standalone/server.js
```

The server listens on port `3000` by default. Set `PORT` to override:

```bash
PORT=4000 node .next/standalone/server.js
```

### What gets produced

```
.next/standalone/
├── server.js          # Entry point — run this with Node
├── server.js.map
└── .next/
    ├── static/        # JS/CSS chunks copied by postbuild
    └── server/        # Server chunks
```

You can copy just `.next/standalone/` to your production host — no `node_modules` required.

### Deploy with PM2

```bash
npm run build
pm2 start .next/standalone/server.js --name interview-engine
pm2 logs interview-engine
```

## IDE Setup

Recommended VS Code extensions:
- **ESLint** — Code linting
- **Prettier** — Code formatting
- **Tailwind CSS IntelliSense** — Autocomplete Tailwind classes
- **Drizzle ORM** — Database schema support

## Next Steps

After setup, read:
- [Architecture](ARCHITECTURE.md) — Understand the system design
- [API](API.md) — Explore the API endpoints
- [Components](COMPONENTS.md) — Learn about React components
