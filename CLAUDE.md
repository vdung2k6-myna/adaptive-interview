# CLAUDE.md

This document defines the conventions, standards, and expectations for AI-assisted development on the **Adaptive Interview Engine** project. Any developer or AI assistant working on this codebase must follow these guidelines.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Development Philosophy](#development-philosophy)
- [Coding Standards](#coding-standards)
- [Architecture Principles](#architecture-principles)
- [OpenSpec Workflow](#openspec-workflow)
- [Documentation Requirements](#documentation-requirements)
- [Performance Guidelines](#performance-guidelines)
- [Security Requirements](#security-requirements)
- [Testing Standards](#testing-standards)
- [Commit & PR Standards](#commit--pr-standards)
- [Environment & Configuration](#environment--configuration)
- [Dependency Management](#dependency-management)
- [Troubleshooting Checklist](#troubleshooting-checklist)

---

## Project Overview

**Adaptive Interview Engine** is an AI-powered technical interview platform built with Next.js, TypeScript, Tailwind CSS, Drizzle ORM, PostgreSQL, and Ollama.

**Key characteristics:**
- Turn-based AI interviewer with real-time streaming
- Vector-based semantic topic tracking
- Post-interview AI evaluation with structured scoring
- Rich Markdown rendering with syntax highlighting
- Anonymous session links (UUID-based)

**Repository root:** `D:\Working\Projects\ollama-chat-react`

---

## Development Philosophy

1. **Spec-driven changes** — Every significant change must have an OpenSpec proposal
2. **Documentation-first** — Update docs before or alongside code changes
3. **Performance-conscious** — Streaming and real-time features require careful optimization
4. **Security-aware** — `dangerouslySetInnerHTML` and LLM outputs require sanitization
5. **Minimal dependencies** — Prefer built-in features over new packages

---

## Coding Standards

### TypeScript

- **Strict mode enabled** — No `any` types unless absolutely necessary
- **Explicit return types** on exported functions
- **Interface over type** for object shapes
- **Use `unknown` over `any`** for error handling: `err instanceof Error`

### React

- **Server components by default** — Only add `"use client"` when needed
- **Memoize expensive components** — `React.memo` for presentational components
- **Extract inline JSX** — Don't inline complex JSX in `.map()` callbacks
- **Ref for mutable state** — Use refs for values that change frequently but don't need to trigger re-renders

### Tailwind CSS

- **Utility-first** — No custom CSS classes unless necessary
- **Dark mode** — Always include `dark:` variants
- **Responsive** — Use `sm:`, `md:`, `lg:` prefixes, not breakpoints in JS
- **Custom CSS only for** — Markdown rendering, syntax highlighting, or third-party integration

### File Naming

| Pattern | Example | Purpose |
|---------|---------|---------|
| `kebab-case.ts` | `api-client.ts` | Utility modules |
| `PascalCase.tsx` | `DashboardPage.tsx` | React components |
| `camelCase.ts` | `buildPrompt.ts` | Functions/hooks |
| `[param]/page.tsx` | `[id]/page.tsx` | Next.js dynamic routes |
| `route.ts` | `route.ts` | Next.js API routes |

### Imports

- **Path aliases** — Use `@/` for project imports (`@/components/MarkdownRenderer`)
- **Group imports** — React, third-party, internal, types
- **No barrel exports** — Import directly from source files

```typescript
import React, { useMemo } from "react";           // React
import { marked } from "marked";                   // Third-party
import hljs from "highlight.js/lib/core";          // Third-party (tree-shaken)
import { MarkdownRenderer } from "@/components/MarkdownRenderer";  // Internal
import type { Message } from "@/lib/schema";      // Types
```

---

## Architecture Principles

### Layer Separation

```
Presentation (Pages/Components)
    ↓
API Layer (Next.js Route Handlers)
    ↓
Business Logic (lib/prompts.ts, lib/evaluation.ts, lib/ollama.ts)
    ↓
Data Access (lib/db.ts, lib/schema.ts)
    ↓
PostgreSQL + pgvector
```

**Rules:**
- Pages don't import from `db.ts` directly — go through API routes
- Business logic is pure TypeScript — no React dependencies
- API routes handle HTTP concerns (status codes, headers, streaming)

### Data Flow

1. User action → API route handler
2. API route → business logic function
3. Business logic → database queries
4. Response streamed or returned as JSON

**No direct DB access from client components.**

### State Management

- **Server state** — Fetched via API routes, stored in React state
- **Local UI state** — `useState` for forms, modals, filters
- **No global state library** — Context or props for shared UI state
- **Refs for streaming** — `useRef` for accumulating streamed content

---

## OpenSpec Workflow

**Every significant change MUST follow the OpenSpec workflow.**

### Steps

1. **Explore** — `/opsx:explore` to understand the problem space
2. **Propose** — Create or update proposal.md with problem, scope, risks
3. **Design** — Create design.md with architecture, data flow, dependencies
4. **Task** — Create tasks.md with checkbox list
5. **Apply** — `/opsx:apply` to implement tasks
6. **Validate** — Build, lint, manual testing
7. **Archive** — `/opsx:archive` when complete

### Artifact Quality

- **proposal.md** — Must include: problem, solution, scope, risks, success criteria
- **design.md** — Must include: architecture diagram, component design, security, dependencies
- **tasks.md** — Must use checkbox format (`- [ ]`), mark complete as you go

### Change Naming

Use kebab-case descriptive names:

```
add-dark-mode
fix-streaming-memory-leak
optimize-evaluation-parsing
refactor-message-bubble
```

---

## 📣 Documentation Requirements

> **⚠️ CRITICAL: For every code change, update ALL relevant documents in `docs/`.**
>
> Outdated documentation is worse than no documentation. It misleads developers and causes bugs.

### Required Updates Per Change Type

| Change Type | Documents to Update |
|-------------|---------------------|
| **New API endpoint** | `API.md`, `ARCHITECTURE.md` |
| **New database table/column** | `DATABASE.md`, `ARCHITECTURE.md` |
| **New component** | `COMPONENTS.md`, `ARCHITECTURE.md` |
| **Ollama/prompt changes** | `OLLAMA.md`, `ARCHITECTURE.md` |
| **Evaluation changes** | `EVALUATION.md`, `ARCHITECTURE.md` |
| **Performance optimization** | `PERFORMANCE.md`, `CHANGELOG.md` |
| **Security fix** | `SECURITY.md`, `CHANGELOG.md` |
| **Dependency added/removed** | `SETUP.md`, `ARCHITECTURE.md` |
| **Environment variable added** | `SETUP.md`, `SECURITY.md` |
| **Any breaking change** | `CHANGELOG.md`, `API.md` |
| **Any new feature** | `README.md`, `CHANGELOG.md` |

### Documentation Checklist

**Before marking a task complete, verify:**

- [ ] `docs/API.md` — Updated if endpoints changed
- [ ] `docs/ARCHITECTURE.md` — Updated if system design changed
- [ ] `docs/DATABASE.md` — Updated if schema changed
- [ ] `docs/COMPONENTS.md` — Updated if components changed
- [ ] `docs/OLLAMA.md` — Updated if AI integration changed
- [ ] `docs/EVALUATION.md` — Updated if scoring changed
- [ ] `docs/PERFORMANCE.md` — Updated if performance characteristics changed
- [ ] `docs/SECURITY.md` — Updated if attack surface changed
- [ ] `docs/SETUP.md` — Updated if setup steps changed
- [ ] `docs/CHANGELOG.md` — Updated with entry for this change
- [ ] `docs/OPENSPEC.md` — Updated if workflow changed

### When Creating a New Document

If a change requires a new document category:

1. Create the file in `docs/`
2. Add it to `docs/README.md` quick links table
3. Update this `CLAUDE.md` table of contents

### Documentation Style

- **Markdown only** — No Word docs, no PDFs
- **Code blocks with language hints** — ```typescript, ```bash, ```json
- **Tables for structured data** — APIs, schemas, configurations
- **ASCII diagrams where helpful** — Architecture, data flow
- **Keep it current** — If code changes, docs must change

---

## Performance Guidelines

### Streaming Optimization

- **Batch state updates** — Never `setData()` on every chunk. Use `performance.now()` for timing.
- **Memoize components** — `React.memo` for message bubbles and renderers
- **Use refs for accumulation** — `useRef` for streaming content, not state
- **Target:** ~20 React re-renders/sec during streaming, not 100+

### Bundle Size

- **Tree-shake libraries** — Import submodules: `highlight.js/lib/languages/javascript`
- **Audit dependencies** — Run `npm audit` regularly
- **Check bundle size** — `npm run build` shows chunk sizes

### Database

- **Index foreign keys** — `sessionId`, `positionId`, `candidateId`
- **Limit raw SQL** — Drizzle query builder for type safety
- **Connection pooling** — `Pool` from `pg` handles this automatically

---

## Security Requirements

### Mandatory Sanitization

**Any `dangerouslySetInnerHTML` MUST be preceded by `DOMPurify.sanitize()`:**

```typescript
const html = DOMPurify.sanitize(marked.parse(content), {
  ADD_ATTR: ["class"],
});
return <div dangerouslySetInnerHTML={{ __html: html }} />;
```

### Input Validation

- **API routes** — Validate all request bodies with Zod or manual checks
- **No raw SQL concatenation** — Always parameterized queries
- **Length limits** — CV text truncated to 800 chars in prompts

### Environment Variables

- **Never commit `.env.local`** — It's in `.gitignore`, verify it's not tracked
- **Rotate credentials** — If `.env.local` was ever committed, rotate DB password
- **No secrets in logs** — Never log `DATABASE_URL` or API keys

---

## Testing Standards

### Manual Testing Checklist

Before considering a feature complete, verify:

- [ ] `npm run build` passes with no errors
- [ ] `npm run lint` passes (or only pre-existing warnings)
- [ ] Feature works in **light mode**
- [ ] Feature works in **dark mode**
- [ ] Feature works on **mobile viewport** (if UI change)
- [ ] No console errors in browser DevTools
- [ ] Network tab shows expected API calls
- [ ] Streaming feels smooth (no jank)

### End-to-End Validation

For major changes, run a full interview:

1. Create position → Create candidate → Start interview
2. Verify first question generates
3. Submit answer → Verify next question streams
4. Complete all turns → Verify evaluation generates
5. Verify transcript page renders correctly

---

## Commit & PR Standards

### Commit Messages

```
feat: Add Markdown rendering for interviewer messages
fix: Batch React state updates during streaming
docs: Update API.md with new evaluation endpoints
refactor: Extract MessageBubble into memoized component
perf: Reduce re-renders by 5× during streaming
security: Add DOMPurify sanitization to MarkdownRenderer
```

### PR Description Template

```markdown
## Change
Brief description of what changed.

## OpenSpec
- Change name: `rich-llm-chat-output`
- Tasks: 7/7 complete

## Testing
- [ ] Build passes
- [ ] Lint passes
- [ ] Manual testing completed

## Documentation
- [ ] API.md updated
- [ ] COMPONENTS.md updated
- [ ] CHANGELOG.md updated
- [ ] (etc.)
```

---

## Environment & Configuration

### Required Environment Variables

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/ai_interview
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
OLLAMA_EMBED_MODEL=mxbai-embed-large
```

### Optional Environment Variables

```bash
EMBEDDING_SIMILARITY_THRESHOLD=0.75  # Default: 0.75
```

### Port Configuration

| Service | Default Port |
|---------|-------------|
| Next.js dev | 3000 |
| PostgreSQL | 5432 |
| Ollama | 11434 |

---

## Dependency Management

### Adding Dependencies

1. **Evaluate necessity** — Can we do this with existing tools?
2. **Check bundle size** — `npm install --save <pkg>` then `npm run build`
3. **Check types** — Does it include TypeScript types?
4. **Document in design.md** — Why this dependency?
5. **Update SETUP.md** — If installation steps change

### Updating Dependencies

```bash
npm outdated          # Check for updates
npm update            # Safe updates
npm audit fix         # Security fixes
```

### Removing Dependencies

```bash
npm uninstall <pkg>
# Then: verify build still passes, update docs
```

---

## Troubleshooting Checklist

When something breaks, check in this order:

1. **Build passes?** `npm run build`
2. **Lint passes?** `npm run lint`
3. **Database running?** `pg_isready`
4. **Migrations applied?** `npx drizzle-kit migrate`
5. **Ollama running?** `ollama list`
6. **Models pulled?** `ollama pull llama3.1`
7. **Env vars set?** `cat .env.local`
8. **Browser console clear?** Check DevTools
9. **Network requests succeed?** Check DevTools Network tab
10. **Docs updated?** Verify `docs/` reflects current code

---

## AI Assistant Instructions

When Claude or another AI assistant works on this project:

1. **Read this file first** — These rules are non-negotiable
2. **Read relevant docs** — Check `docs/` before making changes
3. **Follow OpenSpec workflow** — Explore → Propose → Design → Apply
4. **Update ALL docs** — Every change requires doc updates
5. **Build and lint before finishing** — `npm run build && npm run lint`
6. **Explain your reasoning** — When making architectural decisions, document why
7. **Ask before adding dependencies** — Prefer built-in solutions
8. **Keep changes minimal** — One concern per change, no yak-shaving

---

## Contact & Escalation

- **Questions about OpenSpec workflow** — See `docs/OPENSPEC.md`
- **Questions about architecture** — See `docs/ARCHITECTURE.md`
- **Questions about security** — See `docs/SECURITY.md`
- **Found a bug** — Create an OpenSpec change to fix it

---

*Last updated: 2026-08-08*

**Remember: Outdated documentation is a bug. Update docs with every change.**
