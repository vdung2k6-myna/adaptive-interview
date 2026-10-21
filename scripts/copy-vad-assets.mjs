// Provision the speech-activity assets the VAD worker loads.
//
// Two things are needed at runtime, and only one of them lives in the repository:
//
// - `silero_vad.onnx` is tracked here, because it is the thing this build's
//   behavior is defined by. Its SHA-256 is recorded beside it and checked on
//   every run; a model that does not match is a build failure, not a warning,
//   because a swapped model would change when recordings end with nothing in
//   the build to say so.
// - The ONNX Runtime WebAssembly runtime is copied out of `node_modules` rather
//   than tracked: it is 14 MB of build output that `npm install` already
//   pinned. `public/vad/ort-*` is gitignored for that reason.
//
// Runs from `predev`, `prebuild`, and their port variants. Idempotent: copying
// the same file over itself is cheap and keeps a stale copy from outliving an
// ORT upgrade.

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const cwd = process.cwd();
const source = join(cwd, "node_modules", "onnxruntime-web", "dist");
const dest = join(cwd, "public", "vad");

/** The runtime files the `onnxruntime-web/wasm` entry fetches from `wasmPaths`. */
const RUNTIME_FILES = ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"];

const MODEL = "silero_vad.onnx";
const SUMS = "silero_vad.onnx.sha256";

function fail(message) {
  console.error(`[vad-assets] ${message}`);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });

// The model is the tracked half. Refuse to provision anything unless it is the
// file the checksum file names.
const modelPath = join(dest, MODEL);
const sumsPath = join(dest, SUMS);

if (!existsSync(modelPath)) {
  fail(`${modelPath} is missing. It is tracked in the repository; see ${SUMS}.`);
}
if (!existsSync(sumsPath)) {
  fail(`${sumsPath} is missing, so the model cannot be verified.`);
}

const expected = readFileSync(sumsPath, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .find((line) => line && !line.startsWith("#"))
  ?.split(/\s+/)[0];

if (!expected) {
  fail(`${SUMS} names no checksum.`);
}

const actual = createHash("sha256").update(readFileSync(modelPath)).digest("hex");
if (actual !== expected) {
  fail(`${MODEL} is ${actual}, but ${SUMS} records ${expected}. Replace the model and the checksum together.`);
}

// The runtime is the untracked half. A missing one means `npm install` has not
// run, and a build without it would load a worker that can never infer.
if (!existsSync(source)) {
  fail(`onnxruntime-web is not installed (${source} is missing). Run npm install.`);
}

for (const name of RUNTIME_FILES) {
  const from = join(source, name);
  if (!existsSync(from)) {
    fail(`onnxruntime-web does not ship ${name}; the pinned version changed its runtime layout.`);
  }
  copyFileSync(from, join(dest, name));
}

const sizes = [MODEL, ...RUNTIME_FILES].map((name) => {
  const bytes = statSync(join(dest, name)).size;
  return `${name} ${(bytes / 1024 / 1024).toFixed(1)} MB`;
});

console.log(`[vad-assets] provisioned ${sizes.join(", ")}`);
