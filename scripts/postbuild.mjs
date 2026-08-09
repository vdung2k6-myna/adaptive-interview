// Post-build script for standalone output.
// Next.js standalone mode does not copy .next/static into .next/standalone/.next/.
// This script copies static assets so chunk files are served correctly.

import { cpSync, existsSync } from "fs";
import { join } from "path";

const source = join(process.cwd(), ".next", "static");
const dest = join(process.cwd(), ".next", "standalone", ".next", "static");

if (!existsSync(source)) {
  console.warn("[postbuild] .next/static not found, skipping copy.");
  process.exit(0);
}

cpSync(source, dest, { recursive: true, force: true });
console.log("[postbuild] Copied .next/static → .next/standalone/.next/static");
