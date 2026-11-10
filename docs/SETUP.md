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
git clone <repository-url>
cd adaptive-interview
npm install
```

## 2. Configure Environment

Create `.env.local` in the project root:

```bash
# API Authentication (optional — enables Bearer token on all API routes)
# The backend validates this token; the Next.js server injects it when proxying API requests.
# NEXT_PUBLIC_API_TOKEN=your-backend-token-here

# The backend origin as reached FROM THE NEXT.JS SERVER, not the browser.
# Unset, the proxy uses http://localhost:4000. Never this app's own origin: the
# proxy refuses to forward to itself and answers 502. `NEXT_PUBLIC_` values are
# inlined at build time, so changing this needs `npm run build` and a restart.
# NEXT_PUBLIC_BACKEND_URL=https://api.<domain>

# Only for `next dev` behind a tunnel or a LAN address: the hostnames the dev
# server must serve its chunks to (comma separated). See §3.
# NEXT_DEV_ORIGINS=<public-hostname>
```

The frontend needs `NEXT_PUBLIC_API_TOKEN` only when the backend requires API authentication. Use the same token in both server environments. Database, Ollama, and audio environment variables live in the backend's `.env`.

`NEXT_PUBLIC_BACKEND_URL` names the backend **as the Next.js server reaches it**, not as the browser does. Leave it unset when the backend runs on the same host: the proxy falls back to `http://localhost:4000`. Set it when the server cannot reach that address — for example `http://127.0.0.1:4000` when the backend listens on a specific interface, or `https://api.<domain>` when the backend is on another host.

Never set it to the app's own origin. The proxy compares the configured target with the origin serving the request and refuses a match with `502`, naming the variable, instead of forwarding to itself. Without that guard the request recurses through the public ingress until an edge proxy times out — observed as a Cloudflare `524` after about 100 seconds, with the backend idle.

The value carries the `NEXT_PUBLIC_` prefix, so it is inlined into the build. Editing `.env*` and restarting is not enough: correct it, run `npm run build`, and restart the server.

## 3. Start Development Servers

You need **both** the backend and frontend running.

### Terminal 1 — Backend

```bash
cd adaptive-interview-api
npm run dev          # starts Express on port 4000
```

### Terminal 2 — Frontend

```bash
cd adaptive-interview
npm run dev          # starts Next.js on port 3000
```

Open [http://localhost:3000](http://localhost:3000)

The Next.js catch-all route forwards `/api/*` requests to `http://localhost:4000` and injects `NEXT_PUBLIC_API_TOKEN` server-side. The `/audio/*` rewrite also targets the backend. Both apply in development and production.

### Running the dev server behind a tunnel or from another device

`next dev` serves its scripts only to the hostname it started with. Open the page under any other name — a Cloudflare tunnel, a LAN address — and every chunk is refused with `Blocked cross-origin request to Next.js dev resource`: the HTML renders, nothing on the page works. Name the hostnames in `.env.local`:

```bash
NEXT_DEV_ORIGINS=<public-hostname>
```

Two more things bite a browser that reached the page before an edit:

- The dev server answers chunks with `max-age=14400` and their URLs do not change when a module changes, so a browser keeps running the old bundle for four hours — a fix that tests clean on one machine can appear not to work on a phone. Development now answers `/_next/static/*` with `no-store`; a browser that cached before that change needs its cached files cleared once.
- The service worker is **not registered in development**, and any registration already present is removed (with its caches) on page load, because its cache-first rule would pin the same stale chunks. A page that was controlled by a worker reloads itself once after clearing.

Neither applies to a build: chunk names carry a content hash there, and the worker is registered deliberately.

## 4. Verify Everything Works

1. **Backend running** — `curl http://localhost:4000/health` should return OK
2. **Dashboard** should load at `/dashboard`
3. **Create a position** at `/positions/new`
4. **Create a candidate** at `/candidates/new`
5. **Start an interview** at `/setup` (choose Text or Voice mode)
6. **Verify streaming** — interviewer messages should appear word-by-word (text mode)
7. **Verify Markdown rendering** — bold text, lists, code blocks should render correctly
8. **Complete the interview** — after max turns, evaluation button should appear
9. **Voice mode** (if audio stack is running in backend): verify microphone access, recording, and audio playback
10. **Voice Agent** (`/voice-agent`): configure a persona, start a conversation, verify streaming audio playback and voice/text reply toggles

## Frontend Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js development server (port 3000) |
| `npm run dev:3001` | Start dev server on port 3001 |
| `npm run build` | Production build (outputs `.next/standalone/`) |
| `npm start` | Start production server from standalone bundle |
| `npm run lint` | ESLint check |
| `npm run pwa:assets` | Regenerate PWA icons and iOS splash screens from source |

> **Tip:** To use any port: `npx next dev -p {port}`.

## Production Configuration

For production deployments, create `.env.production` in the project root. Next.js automatically loads it when `NODE_ENV=production`:

```bash
# .env.production (frontend only)
NEXT_PUBLIC_API_TOKEN=your-backend-token
```

The backend has its own production `.env` with `DATABASE_URL`, `OLLAMA_BASE_URL`, `API_AUTH_TOKEN`, etc.

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
├── public/            # Static PWA assets (icons, manifest, service worker)
└── .next/
    ├── static/        # JS/CSS chunks copied by postbuild
    └── server/        # Server chunks
```

You can copy just `.next/standalone/` to your production host — no `node_modules` required.

### Progressive Web App (PWA) deployment

The frontend is configured as a Progressive Web App. For the "Add to Home Screen" prompt to appear, the production host **must serve the site over HTTPS** with a valid certificate.

PWA assets generated during the build:

| Asset | Path | Purpose |
|---|---|---|
| Manifest | `/manifest.json` | Tells Chrome how to install the app |
| Service Worker | `/sw.js` | Caches the shell; stamped per build to avoid stale caches |
| Icons | `/icon-192.png`, `/icon-512.png`, `/icon-maskable.png` | Launcher and adaptive icons |
| Apple Touch Icon | `/apple-touch-icon.png` | iOS home screen icon |
| iOS Splash Screens | `/apple-touch-startup-image-*.png` | Branded launch images for iPhone/iPad |
| Offline fallback | `/offline.html` | Shown when the app is launched without connectivity |

The `scripts/postbuild.mjs` step copies `public/` into `.next/standalone/public/` and stamps the service worker cache version with a build id. Do not disable this step for production builds.

To regenerate the icon and splash-screen set from the source generator:

```bash
npm run pwa:assets
# or directly:
node scripts/generate-pwa-icons.mjs
```

> **Note:** PWA install prompts and service workers require a secure context (HTTPS or `localhost` for local development). HTTP-only production deployments will not show the install banner.

#### iOS-specific notes

- iOS Safari does **not** show an install banner. Users install via **Share → Add to Home Screen**.
- Standalone launch on iOS requires the `apple-mobile-web-app-capable` meta tag (already in `src/app/layout.tsx`).
- The status bar uses `black-translucent` and the viewport uses `viewport-fit=cover` so the app renders edge-to-edge on notched devices.
- The top navigation bar adds `env(safe-area-inset-top)` padding to avoid overlapping the Dynamic Island/status bar.
- Voice interviews in iOS standalone mode require manual testing; microphone permission behavior varies across iOS versions.

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

If the backend is healthy and the page still fails, read the URL the browser tried. `Failed to fetch` is thrown before any response exists, and the two causes look identical from the outside:

- **The URL is `http://localhost:4000/...` in the browser.** The page is running a bundle from before the server-side proxy; current builds call `/api/...` on the page's own origin. Clear the site's cached files (or rebuild) to load the current bundle.
- **The server answers `502` naming `NEXT_PUBLIC_BACKEND_URL`.** The configured backend origin is this app's own origin. Point it at the backend, rebuild, and restart (§2).
- **The URL is the page's own origin and the request never reaches the server.** Check the backend's access log; nothing there means the browser refused the request (mixed content on an `http` API behind an `https` page, or a service worker holding a stale bundle).

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

- Check browser DevTools Network tab — look for the `POST /api/messages` stream
- Verify the backend is returning `text/plain` NDJSON chunks
- Some reverse proxies buffer responses — ensure yours doesn't

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
- Check browser settings → Privacy → Microphone
- Use HTTPS or localhost (MediaRecorder requires secure context)

**Symptom:** Audio files not found (404 on `/audio/...`)

Audio files are served by the backend. Check:

- Backend `AUDIO_STORAGE_DIR` env var
- That the backend has write permissions to the storage directory
- That the audio file URL is being returned by the backend

## IDE Setup

Recommended VS Code extensions:

- **ESLint** — Code linting
- **Prettier** — Code formatting
- **Tailwind CSS IntelliSense** — Autocomplete Tailwind classes

## Next Steps

After setup, read:

- [Architecture](ARCHITECTURE.md) — Understand the frontend's role in the system
- [Components](COMPONENTS.md) — Learn about React components
- [Backend Setup Guide](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/SETUP.md) — For DB, Ollama, and audio services
- [Backend API Reference](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/API.md) — Full API documentation
