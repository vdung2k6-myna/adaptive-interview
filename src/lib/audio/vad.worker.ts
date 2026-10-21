/**
 * The inference worker: where Silero VAD actually runs.
 *
 * It owns the session, the model's carried state, and the frame contract. It owns no
 * recording — the recorder asks, this answers, and a `reset` is the only thing that
 * tells it a new recording began. Keeping it here rather than on the main thread is
 * what keeps a slow device's rendering from waiting behind a model call.
 *
 * The message chain is deliberate. `onmessage` is async, so without serialization a
 * second frame could be classified while the first is awaiting the model, and frames
 * would reach the stateful model out of order. One chain preserves arrival order and
 * makes the one-in-flight rule on the client a bound on staleness rather than a
 * correctness requirement.
 *
 * On any failure — the model cannot be fetched, the runtime cannot start, inference
 * throws — the worker reports it and stops answering classifications. The client
 * degrades to the level gate; this file never pretends a failed model said "not
 * speech", which would silently stop every turn.
 */

import * as ort from "onnxruntime-web/wasm";

import {
  createSileroClassifier,
  MODEL_URL,
  type OrtRuntimeLike,
} from "./vad-model.ts";
import type { VoiceActivity } from "./voice-activity.ts";
import type { VadRequest, VadResponse } from "./vad-protocol.ts";

/** Where `scripts/copy-vad-assets.mjs` put the model and the runtime. */
const ASSET_BASE = "/vad/";

interface WorkerScope {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: VadResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

let activity: VoiceActivity<Float32Array> | null = null;

const post = (message: VadResponse): void => scope.postMessage(message);

async function load(): Promise<void> {
  if (activity) return;

  ort.env.wasm.wasmPaths = ASSET_BASE;
  // No COOP/COEP headers, so the threaded build cannot start. Single-threaded is
  // fast enough for 32 ms frames and avoids changing what the app may load.
  ort.env.wasm.numThreads = 1;

  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    throw new Error(`${MODEL_URL} answered ${response.status} ${response.statusText}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  activity = await createSileroClassifier(ort as unknown as OrtRuntimeLike, bytes);
}

async function handle(message: VadRequest): Promise<void> {
  try {
    await load();

    if (message.type === "init") {
      post({ type: "ready" });
      return;
    }

    if (message.type === "reset") {
      activity!.reset();
      return;
    }

    const probability = await activity!.classify(message.frame);
    post({ type: "probability", id: message.id, probability });
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (message.type === "classify") {
      post({ type: "classify-failed", id: message.id, message: text });
    } else {
      post({ type: "failed", message: text });
    }
  }
}

let chain: Promise<void> = Promise.resolve();

scope.onmessage = (event) => {
  const message = event.data as VadRequest;
  chain = chain.then(() => handle(message));
};
