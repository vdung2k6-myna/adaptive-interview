# Development Setup Guide

This guide covers setting up only the **Next.js frontend**. The database, migrations, Ollama integration, and audio services all live in the [backend repository](https://github.com/vdung2k6-myna/adaptive-interview-api). See [adaptive-interview-api/docs/SETUP.md](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/SETUP.md) for backend setup.

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** or **yarn**
- A running **backend** (`adaptive-interview-api` on port 4000)

If you don't have the backend running yet, set it up first:

- [Backend Setup Guide](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/SETUP.md)

## 1. Clone and Install

```bash
git clone https://github.com/vdung2k6-myna/adaptive-interview.git
cd adaptive-interview
npm install
```

## 2. Configure Environment

Create `.env.local` in the project root:

```bash
# API Authentication (optional â€” enables Bearer token on all API routes)
# The backend validates this token; the frontend injects it via apiFetch()
# NEXT_PUBLIC_API_TOKEN=your-secret-token-here
```

The frontend needs only `NEXT_PUBLIC_API_TOKEN` (and only when the backend has `API_AUTH_TOKEN` configured). Database, Ollama, and audio environment variables live in the backend's `.env`.

## 3. Start Development Servers

You need **both** the backend and frontend running.

### Terminal 1 â€” Backend

```bash
cd adaptive-interview-api
npm run dev          # starts Express on port 4000
```

### Terminal 2 â€” Frontend

```bash
cd adaptive-interview
npm run dev          # starts Next.js on port 3000
```

Open [http://localhost:3000](http://localhost:3000)

The frontend's `next.config.ts` automatically proxies `/api/*` and `/audio/*` requests to `http://localhost:4000` during development.

## 4. Verify Everything Works

1. **Backend running** â€” `curl http://localhost:4000/health` should return OK
2. **Dashboard** should load at `/dashboard`
3. **Create a position** at `/positions/new`
4. **Create a candidate** at `/candidates/new`
5. **Start an interview** at `/setup` (choose Text or Voice mode)
6. **Verify streaming** â€” interviewer messages should appear word-by-word (text mode)
7. **Verify Markdown rendering** â€” bold text, lists, code blocks should render correctly
8. **Complete the interview** â€” after max turns, evaluation button should appear
9. **Voice mode** (if audio stack is running in backend): verify microphone access, recording, and audio playback

## Frontend Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js development server (port 3000) |
| `npm run dev:3001` | Start dev server on port 3001 |
| `npm run build` | Production build (outputs `.next/standalone/`) |
| `npm start` | Start production server from standalone bundle |
| `npm run lint` | ESLint check |

> **Tip:** To use any port: `npx next dev -p {port}`.

## Production Configuration

For production deployments, create `.env.production` in the project root. Next.js automatically loads it when `NODE_ENV=production`:

```bash
# .env.production (frontend only)
NEXT_PUBLIC_API_TOKEN=your-production-token
```

The backend has its own production `.env` with `DATABASE_URL`, `OLLAMA_BASE_URL`, `API_AUTH_TOKEN`, etc.

Because `next.config.ts` sets `output: "standalone"`, the build produces a self-contained server bundle.

### Build

```bash
npm run build
```

After the build completes, `npm run postbuild` runs automatically and copies `.next/static/` into `.next/standalone/.next/static/`. This is required â€” Next.js standalone mode does not copy static chunks by default, and without this step you will see `Failed to load chunk` errors in the browser.

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
â”œâ”€â”€ server.js          # Entry point â€” run this with Node
â”œâ”€â”€ server.js.map
â””â”€â”€ .next/
    â”œâ”€â”€ static/        # JS/CSS chunks copied by postbuild
    â””â”€â”€ server/        # Server chunks
```

You can copy just `.next/standalone/` to your production host â€” no `node_modules` required.

### Deploy with PM2

```bash
npm run build
pm2 start .next/standalone/server.js --name interview-engine-ui
pm2 logs interview-engine-ui
```

## Troubleshooting

### Frontend cannot reach backend

**Symptom:** API calls fail with `TypeError: Failed to fetch` or `502 Bad Gateway`

**Fix:**

```bash
# Check if backend is running
curl http://localhost:4000/health

# Start backend
cd adaptive-interview-api
npm run dev
```

### Ollama errors

The frontend does not talk to Ollama directly. If interview generation fails, check the backend and Ollama:

```bash
# Backend
curl http://localhost:4000/health

# Ollama
ollama ps
ollama serve
```

### Streaming Not Working

**Symptom:** Messages appear all at once instead of word-by-word

**Fix:**

- Check browser DevTools Network tab â€” look for the `POST /api/messages` stream
- Verify the backend is returning `text/plain` NDJSON chunks
- Some reverse proxies buffer responses â€” ensure yours doesn't

### Voice Interview Not Working

**Symptom:** "Voice service unavailable" or audio fails to play

**Fix:**

```bash
# Check if backend audio routes are reachable
curl http://localhost:4000/api/voice/health

# Check if audio.cpp is running
curl http://localhost:8080/health

# Verify audio services are started in backend repo
cd adaptive-interview-api
npm run start:audio
```

**Symptom:** Microphone access denied

**Fix:**

- Ensure the browser has permission to access the microphone
- Check browser settings â†’ Privacy â†’ Microphone
- Use HTTPS or localhost (MediaRecorder requires secure context)

**Symptom:** Audio files not found (404 on `/audio/...`)

Audio files are served by the backend. Check:

- Backend `AUDIO_STORAGE_DIR` env var
- That the backend has write permissions to the storage directory
- That the audio file URL is being returned by the backend

## IDE Setup

Recommended VS Code extensions:

- **ESLint** â€” Code linting
- **Prettier** â€” Code formatting
- **Tailwind CSS IntelliSense** â€” Autocomplete Tailwind classes

## Next Steps

After setup, read:

- [Architecture](ARCHITECTURE.md) â€” Understand the frontend's role in the system
- [Components](COMPONENTS.md) â€” Learn about React components
- [Backend Setup Guide](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/SETUP.md) â€” For DB, Ollama, and audio services
- [Backend API Reference](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/API.md) â€” Full API documentation
