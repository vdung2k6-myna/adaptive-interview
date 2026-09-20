// Post-build script for standalone output.
// Next.js standalone mode does not copy .next/static into .next/standalone/.next/.
// This script copies static assets so chunk files are served correctly.
// It also stamps the service worker cache version with the build's identity, and
// fails the build if it cannot — an unstamped worker would name its caches after
// nothing and, because the stamp is also what tells a browser the script changed,
// would keep the previous worker installed.

import { cpSync, existsSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";

const cwd = process.cwd();
const PLACEHOLDER = "__BUILD_ID__";

function fail(message) {
  console.error(`[postbuild] ${message}`);
  process.exit(1);
}

const source = join(cwd, ".next", "static");
const dest = join(cwd, ".next", "standalone", ".next", "static");

if (!existsSync(source)) {
  console.warn("[postbuild] .next/static not found, skipping copy.");
} else {
  cpSync(source, dest, { recursive: true, force: true });
  console.log("[postbuild] Copied .next/static → .next/standalone/.next/static");
}

// The app registers /sw.js, so a build output without it serves a 404 for a file
// every page asks for. Check the source before copying so the failure names it.
const publicSource = join(cwd, "public");
const publicDest = join(cwd, ".next", "standalone", "public");
const swSource = join(publicSource, "sw.js");

if (!existsSync(swSource)) {
  fail(`public/sw.js not found in ${publicSource}. Every page registers /sw.js, so this build would serve a 404 for it.`);
}

// Copy public PWA assets into the standalone output if Next.js hasn't already.
cpSync(publicSource, publicDest, { recursive: true, force: true });
console.log("[postbuild] Copied public/ → .next/standalone/public");

// Stamp the worker's cache version. This runs after the copy above, so the file
// checked here is always the freshly copied one — re-running this script for one
// build cannot fail on an artifact an earlier run already stamped.
const swDest = join(publicDest, "sw.js");

if (!existsSync(swDest)) {
  fail(`Service worker not found at ${swDest} after copying public/.`);
}

const original = readFileSync(swDest, "utf8");

if (!original.includes(PLACEHOLDER)) {
  fail(`${swDest} does not contain ${PLACEHOLDER}, so its cache version would be unresolved. Nothing was stamped.`);
}

// Prefer the identity of the build itself when Next.js wrote one, so a browser's
// cache names can be traced back to the build that produced them.
function readBuildId() {
  const buildIdPath = join(cwd, ".next", "BUILD_ID");
  if (existsSync(buildIdPath)) {
    const buildId = readFileSync(buildIdPath, "utf8").trim();
    if (buildId) {
      return buildId;
    }
  }
  return (
    process.env.NEXT_BUILD_ID ||
    createHash("sha256").update(Date.now().toString()).digest("hex").slice(0, 16)
  );
}

const buildId = readBuildId();
writeFileSync(swDest, original.replace(/__BUILD_ID__/g, () => buildId));
console.log(`[postbuild] Stamped service worker cache version: ${buildId}`);
