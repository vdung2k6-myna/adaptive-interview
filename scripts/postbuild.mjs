// Post-build script for standalone output.
// Next.js standalone mode does not copy .next/static into .next/standalone/.next/.
// This script copies static assets so chunk files are served correctly.
// It also stamps the service worker cache version with a build id.

import { cpSync, existsSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";

const source = join(process.cwd(), ".next", "static");
const dest = join(process.cwd(), ".next", "standalone", ".next", "static");

if (!existsSync(source)) {
  console.warn("[postbuild] .next/static not found, skipping copy.");
} else {
  cpSync(source, dest, { recursive: true, force: true });
  console.log("[postbuild] Copied .next/static → .next/standalone/.next/static");
}

// Copy public PWA assets into the standalone output if Next.js hasn't already.
const publicSource = join(process.cwd(), "public");
const publicDest = join(process.cwd(), ".next", "standalone", "public");
if (existsSync(publicSource)) {
  cpSync(publicSource, publicDest, { recursive: true, force: true });
  console.log("[postbuild] Copied public/ → .next/standalone/public");
}

// Stamp service worker cache version with a deterministic build id so each
// deployment invalidates old PWA caches immediately.
const swDest = join(process.cwd(), ".next", "standalone", "public", "sw.js");

if (existsSync(swDest)) {
  const buildId = process.env.NEXT_BUILD_ID || createHash("sha256").update(Date.now().toString()).digest("hex").slice(0, 16);
  const original = readFileSync(swDest, "utf8");
  const stamped = original.replace(/__BUILD_ID__/g, buildId);
  if (stamped !== original) {
    writeFileSync(swDest, stamped);
    console.log(`[postbuild] Stamped service worker cache version: ${buildId}`);
  } else {
    console.warn("[postbuild] Service worker did not contain __BUILD_ID__ placeholder.");
  }
} else {
  console.warn("[postbuild] Service worker not found in standalone output.");
}
