#!/usr/bin/env node
// README drift checker — compares README content against actual codebase.
// Run with: node scripts/check-readme.mjs
// Exit code 0 = OK, 1 = drift detected

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const readmePath = join(process.cwd(), "README.md");
if (!existsSync(readmePath)) {
  console.error("README.md not found");
  process.exit(1);
}

const readme = readFileSync(readmePath, "utf-8");
let exitCode = 0;

function report(title, missingInReadme, staleInReadme) {
  const hasIssues = missingInReadme.length > 0 || staleInReadme.length > 0;
  if (!hasIssues) return;
  exitCode = 1;
  console.log(`\n❌ ${title}`);
  if (missingInReadme.length) {
    console.log(`   In code but missing from README:`);
    missingInReadme.forEach((item) => console.log(`      - ${item}`));
  }
  if (staleInReadme.length) {
    console.log(`   In README but missing from code:`);
    staleInReadme.forEach((item) => console.log(`      - ${item}`));
  }
}

/* ───────────────────────────────────────────
   1. API Routes
   ─────────────────────────────────────────── */
function collectApiRoutes(dir, prefix = "") {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = entry.name;
    if (entry.isDirectory()) {
      const sub = collectApiRoutes(join(dir, name), `${prefix}/${name}`);
      results.push(...sub);
    } else if (name === "route.ts") {
      results.push(prefix || "/");
    }
  }
  return results;
}

const apiDir = join(process.cwd(), "src", "app", "api");
const actualApiRoutes = collectApiRoutes(apiDir).map((r) => `/api${r}`);

// Extract API routes from README — match patterns like `| POST | /api/... |`
const readmeApiRoutes = [...readme.matchAll(/\|\s*`?(GET|POST|PATCH|DELETE)`?\s*\|\s*(`?\/api\/[^`|\s]+`?)\s*\|/g)]
  .map((m) => m[2].replace(/`/g, ""))
  .filter((v, i, a) => a.indexOf(v) === i);

// README mentions route families (e.g. /api/campaigns/:id), so normalize
function normalizeRoute(r) {
  return r.replace(/:id/g, "[id]").replace(/:versionId/g, "[versionId]").replace(/:sessionId/g, "[sessionId]");
}

const actualApiSet = new Set(actualApiRoutes.map(normalizeRoute));
const readmeApiSet = new Set(readmeApiRoutes.map(normalizeRoute));

const apiMissing = [...actualApiSet].filter((r) => !readmeApiSet.has(r));
const apiStale = [...readmeApiSet].filter((r) => !actualApiSet.has(r));
report("API Routes", apiMissing, apiStale);

/* ───────────────────────────────────────────
   2. Page Routes
   ─────────────────────────────────────────── */
function collectPages(dir, prefix = "") {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = entry.name;
    const full = join(dir, name);
    if (entry.isDirectory()) {
      if (name.startsWith("[")) {
        // dynamic segment
        const sub = collectPages(full, `${prefix}/[...]`);
        results.push(...sub);
      } else {
        const sub = collectPages(full, `${prefix}/${name}`);
        results.push(...sub);
      }
    } else if (name === "page.tsx") {
      results.push(prefix || "/");
    }
  }
  return results;
}

const appDir = join(process.cwd(), "src", "app");
const actualPages = collectPages(appDir);

// Extract page routes from README — match backtick paths like `/dashboard`, `/campaigns/new`
const readmePageMatches = [...readme.matchAll(/`(\/[^`\s]+)`/g)]
  .map((m) => m[1])
  .filter((r) => r.startsWith("/"))
  .filter((r) => !r.startsWith("/api/")) // exclude API routes
  .filter((r) => !r.includes(".") || r.endsWith(".tsx")) // rough filter
  .filter((v, i, a) => a.indexOf(v) === i);

// Normalize dynamic segments for comparison
function normalizePage(r) {
  return r.replace(/\[[^\]]+\]/g, "[...]").replace(/\/$/, "");
}

const actualPageSet = new Set(actualPages.map(normalizePage));
const readmePageSet = new Set(readmePageMatches.map(normalizePage));

// We won't flag README-only routes as "stale" because docs often mention
// conceptual paths (like /interview/{id}) that aren't literal file paths.
const pageMissing = [...actualPageSet].filter((r) => !readmePageSet.has(r) && r !== "");
if (pageMissing.length) {
  report("Page Routes", pageMissing, []);
}

/* ───────────────────────────────────────────
   3. Database Tables
   ─────────────────────────────────────────── */
const schemaPath = join(process.cwd(), "src", "lib", "schema.ts");
let actualTables = [];
if (existsSync(schemaPath)) {
  const schemaSrc = readFileSync(schemaPath, "utf-8");
  actualTables = [...schemaSrc.matchAll(/export\s+const\s+(\w+)\s+=\s+pgTable/g)].map((m) => m[1]);
}

const readmeTableMatches = [...readme.matchAll(/\*\*(\w+)\*\*\s*\|/g)]
  .map((m) => m[1])
  .filter((name) =>
    ["positions", "candidates", "interviewSessions", "messages", "embeddings", "evaluations", "evaluationVersions", "campaigns", "campaignPositions"].includes(name)
  );

const tableSet = new Set(actualTables);
const readmeTableSet = new Set(readmeTableMatches);
const tableMissing = [...tableSet].filter((t) => !readmeTableSet.has(t));
const tableStale = [...readmeTableSet].filter((t) => !tableSet.has(t));
report("Database Tables", tableMissing, tableStale);

/* ───────────────────────────────────────────
   4. Components
   ─────────────────────────────────────────── */
const componentsDir = join(process.cwd(), "src", "components");
let actualComponents = [];
if (existsSync(componentsDir)) {
  actualComponents = readdirSync(componentsDir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(/\.tsx$/, ""));
}

const readmeComponentMatches = [...readme.matchAll(/([A-Z][a-zA-Z0-9]+\.tsx)/g)]
  .map((m) => m[1].replace(/\.tsx$/, ""))
  .filter((v, i, a) => a.indexOf(v) === i);

const compSet = new Set(actualComponents);
const readmeCompSet = new Set(readmeComponentMatches);
const compMissing = [...compSet].filter((c) => !readmeCompSet.has(c));
const compStale = [...readmeCompSet].filter((c) => !compSet.has(c));
report("Components", compMissing, compStale);

/* ───────────────────────────────────────────
   5. Package Scripts
   ─────────────────────────────────────────── */
const packagePath = join(process.cwd(), "package.json");
let actualScripts = [];
if (existsSync(packagePath)) {
  const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));
  actualScripts = Object.keys(pkg.scripts || {});
}

const readmeScriptMatches = [
  ...readme.matchAll(/`npm run ([\w:-]+)`/g),
  ...readme.matchAll(/`npm (start)`/g),
]
  .map((m) => m[1])
  .filter((v, i, a) => a.indexOf(v) === i);

const scriptSet = new Set(actualScripts);
const readmeScriptSet = new Set(readmeScriptMatches);
const scriptMissing = [...scriptSet].filter((s) => !readmeScriptSet.has(s));
const scriptStale = [...readmeScriptSet].filter((s) => !scriptSet.has(s));
report("Package Scripts", scriptMissing, scriptStale);

/* ───────────────────────────────────────────
   Summary
   ─────────────────────────────────────────── */
if (exitCode === 0) {
  console.log("✅ README drift check passed — no obvious discrepancies found.\n");
} else {
  console.log("\n⚠️  README may be out of sync with the codebase.\n");
  console.log("   Update README.md and re-run this check.\n");
}

process.exit(exitCode);
