/**
 * The recorder's half of speech classification.
 *
 * The worker answers one frame at a time; the recorder judges a frame every 32 ms. This
 * client keeps those two clocks apart: it offers the newest frame only when the previous
 * answer has arrived, and otherwise lets the recorder reuse the last probability. A
 * classification is never blocked on, because the recording must not depend on the
 * model being fast — or on it answering at all.
 *
 * **Failure is a mode, not an exception.** A model that cannot load, a worker that
 * cannot start, or an inference that throws sets a degraded mode: `probability()`
 * answers `undefined`, which the endpointer reads as "level gate alone", and the reason
 * is reported once. The recorder continues. A classifier that cannot be trusted must
 * not be allowed to vote "not speech", because that is the one answer that silently
 * cuts a turn.
 *
 * The worker is injected so the suite can hold all of this without a browser.
 */

import type { VadRequest, VadResponse } from "./vad-protocol.ts";

/** The slice of `Worker` this client uses, so a test can stand in for it. */
export interface VadWorker {
  postMessage(message: VadRequest, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  terminate(): void;
}

export type VadStatus = "idle" | "loading" | "ready" | "degraded";

export interface VadClient {
  /** Load the model. Resolves true when it is ready, false when it degraded. */
  start(): Promise<boolean>;
  /**
   * Offer a frame. Transfers the buffer, so the caller must not use `frame` after
   * this call. A no-op unless the classifier is ready and idle.
   */
  observe(frame: Float32Array): void;
  /** The latest probability, or undefined when there is no usable classifier. */
  probability(): number | undefined;
  /** A new recording: forget the last answer and the model's carried state. */
  reset(): void;
  dispose(): void;
  status(): VadStatus;
}

export function createVadClient(options: {
  createWorker: () => VadWorker;
  /** Called once, with the reason, when the classifier stops being usable. */
  onDegraded?: (reason: string) => void;
}): VadClient {
  let worker: VadWorker | null = null;
  let status: VadStatus = "idle";
  let last: number | undefined;
  let busy = false;
  let nextId = 1;
  let inFlight: number | null = null;
  let startPromise: Promise<boolean> | null = null;
  let resolveStart: ((ready: boolean) => void) | null = null;
  let degradedReported = false;
  let disposed = false;

  const settle = (ready: boolean): void => {
    resolveStart?.(ready);
    resolveStart = null;
    startPromise = null;
  };

  const degrade = (reason: string): void => {
    if (status === "degraded") return;
    status = "degraded";
    last = undefined;
    busy = false;
    inFlight = null;
    settle(false);
    if (!degradedReported) {
      degradedReported = true;
      options.onDegraded?.(reason);
    }
  };

  const onMessage = (event: MessageEvent): void => {
    const message = event.data as VadResponse;

    switch (message.type) {
      case "ready":
        if (status === "loading") {
          status = "ready";
          settle(true);
        }
        return;

      case "failed":
        degrade(message.message);
        return;

      case "probability":
        // A late answer belongs to a frame the recorder has already moved past — a
        // reset, or a frame it stopped waiting for. It is not this recording's vote.
        if (message.id !== inFlight) return;
        inFlight = null;
        busy = false;
        last = message.probability;
        return;

      case "classify-failed":
        if (message.id !== inFlight) return;
        degrade(message.message);
        return;
    }
  };

  return {
    start() {
      if (disposed) return Promise.resolve(false);
      if (status === "ready") return Promise.resolve(true);
      if (status === "degraded") return Promise.resolve(false);
      if (startPromise) return startPromise;

      // Held locally because `degrade()` clears the shared slot when the worker
      // cannot be created; the caller still has to be answered.
      const promise = new Promise<boolean>((resolve) => {
        resolveStart = resolve;
      });
      startPromise = promise;

      try {
        if (!worker) {
          worker = options.createWorker();
          worker.addEventListener("message", onMessage);
        }
        status = "loading";
        worker.postMessage({ type: "init" });
      } catch (error) {
        degrade(error instanceof Error ? error.message : String(error));
      }

      return promise;
    },

    observe(frame) {
      if (disposed || status !== "ready" || busy) return;

      const id = nextId++;
      busy = true;
      inFlight = id;

      try {
        // The buffer is transferred: the recorder built this frame for the model and
        // has no second reader. Copying it would be a 2 KB allocation per 32 ms.
        worker!.postMessage({ type: "classify", id, frame }, [frame.buffer]);
      } catch (error) {
        degrade(error instanceof Error ? error.message : String(error));
      }
    },

    probability() {
      return last;
    },

    reset() {
      last = undefined;
      busy = false;
      inFlight = null;
      if (!disposed && worker && status === "ready") {
        worker.postMessage({ type: "reset" });
      }
    },

    dispose() {
      disposed = true;
      worker?.terminate();
      worker = null;
      status = "idle";
      last = undefined;
      busy = false;
      inFlight = null;
      settle(false);
    },

    status() {
      return status;
    },
  };
}

/**
 * The browser's worker, created from this module so a bundler sees the dependency.
 *
 * Kept beside the client rather than in the recorder: the recorder should not know
 * where inference runs, and a test that constructs a client never reaches this.
 */
export function createBrowserVadWorker(): VadWorker {
  return new Worker(new URL("./vad.worker.ts", import.meta.url), {
    type: "module",
    name: "vad",
  });
}
