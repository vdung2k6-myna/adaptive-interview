/**
 * The VAD client's suite. Run with Node's own runner:
 *
 *   node --test src/lib/audio/vad-client.test.ts
 *
 * The worker is a stand-in, so what is pinned here is the policy around it: one frame
 * in flight, the last probability reused while waiting, a late answer ignored after a
 * reset, and a failure becoming one reported degradation rather than a stream of them.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createVadClient, type VadWorker } from "./vad-client.ts";
import type { VadRequest, VadResponse } from "./vad-protocol.ts";

class FakeWorker implements VadWorker {
  readonly messages: VadRequest[] = [];
  terminated = false;
  private listener: ((event: MessageEvent) => void) | null = null;

  postMessage(message: VadRequest): void {
    this.messages.push(message);
  }

  addEventListener(_type: "message", listener: (event: MessageEvent) => void): void {
    this.listener = listener;
  }

  terminate(): void {
    this.terminated = true;
  }

  reply(message: VadResponse): void {
    assert.ok(this.listener, "the client must have subscribed before replying");
    this.listener({ data: message } as MessageEvent);
  }

  classifications(): Extract<VadRequest, { type: "classify" }>[] {
    return this.messages.filter(
      (message): message is Extract<VadRequest, { type: "classify" }> =>
        message.type === "classify"
    );
  }
}

function frame(): Float32Array {
  return new Float32Array(512);
}

function harness(): {
  worker: FakeWorker;
  client: ReturnType<typeof createVadClient>;
  degraded: string[];
} {
  const worker = new FakeWorker();
  const degraded: string[] = [];
  const client = createVadClient({
    createWorker: () => worker,
    onDegraded: (reason) => degraded.push(reason),
  });
  return { worker, client, degraded };
}

async function ready(): Promise<ReturnType<typeof harness>> {
  const h = harness();
  const started = h.client.start();
  h.worker.reply({ type: "ready" });
  assert.equal(await started, true);
  return h;
}

describe("the VAD client", () => {
  it("does not offer a frame before the model is ready", () => {
    const { worker, client } = harness();

    client.observe(frame());

    assert.equal(worker.classifications().length, 0);
    assert.equal(client.probability(), undefined);
    assert.equal(client.status(), "idle");
  });

  it("starts once and reports readiness", async () => {
    const { worker, client } = harness();
    const started = client.start();
    const again = client.start();

    assert.equal(worker.messages.length, 1, "start must not load the model twice");
    worker.reply({ type: "ready" });

    assert.equal(await started, true);
    assert.equal(await again, true);
    assert.equal(client.status(), "ready");
  });

  it("keeps one frame in flight and reuses the last probability", async () => {
    const { worker, client } = await ready();

    client.observe(frame());
    client.observe(frame());
    assert.equal(worker.classifications().length, 1);

    const [first] = worker.classifications();
    worker.reply({ type: "probability", id: first!.id, probability: 0.7 });
    assert.equal(client.probability(), 0.7);

    client.observe(frame());
    assert.equal(worker.classifications().length, 2, "the next frame may go once one returns");
  });

  it("ignores an answer that arrives after a reset", async () => {
    const { worker, client } = await ready();

    client.observe(frame());
    const [inFlight] = worker.classifications();
    client.reset();

    worker.reply({ type: "probability", id: inFlight!.id, probability: 1 });
    assert.equal(client.probability(), undefined);
  });

  it("sends a reset only while the worker is usable", async () => {
    const { worker, client } = await ready();

    client.reset();
    assert.deepEqual(worker.messages.at(-1), { type: "reset" });
  });

  it("reports a failed load once and stays degraded", async () => {
    const { worker, client, degraded } = harness();

    const started = client.start();
    worker.reply({ type: "failed", message: "the model is missing" });

    assert.equal(await started, false);
    assert.deepEqual(degraded, ["the model is missing"]);
    assert.equal(client.status(), "degraded");
    assert.equal(client.probability(), undefined);

    assert.equal(await client.start(), false);
    assert.deepEqual(degraded, ["the model is missing"], "a second start must not report again");

    client.observe(frame());
    assert.equal(worker.classifications().length, 0);
  });

  it("degrades once when a classification fails", async () => {
    const { worker, client, degraded } = await ready();

    client.observe(frame());
    const [first] = worker.classifications();
    worker.reply({ type: "classify-failed", id: first!.id, message: "the runtime stopped" });

    assert.deepEqual(degraded, ["the runtime stopped"]);
    assert.equal(client.status(), "degraded");
    assert.equal(client.probability(), undefined);

    client.observe(frame());
    assert.equal(worker.classifications().length, 1);
  });

  it("degrades when the worker cannot even be created", async () => {
    const degraded: string[] = [];
    const client = createVadClient({
      createWorker: () => {
        throw new Error("workers are unavailable");
      },
      onDegraded: (reason) => degraded.push(reason),
    });

    assert.equal(await client.start(), false);
    assert.deepEqual(degraded, ["workers are unavailable"]);
    assert.equal(client.status(), "degraded");
  });

  it("terminates the worker on dispose", async () => {
    const { worker, client } = await ready();

    client.dispose();

    assert.equal(worker.terminated, true);
    assert.equal(client.status(), "idle");
    client.observe(frame());
    assert.equal(worker.classifications().length, 0);
  });
});
