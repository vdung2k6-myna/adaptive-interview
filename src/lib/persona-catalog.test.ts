/**
 * The client's persona-catalog suite. Run with Node's own runner:
 *
 *   node --test src/lib/persona-catalog.test.ts
 *
 * No vitest, no jest, no dependency — the module takes its `fetch` as a
 * parameter and imports nothing, so this needs nothing installed. Note the `.ts`
 * extension in the import below: Node resolves it directly, while the page
 * imports the same module through the `@/*` alias.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ANSWER_MODE,
  fetchPersonaCatalog,
  parseCatalog,
  resolveAnswerMode,
  resolvePersona,
  toCatalogPersona,
  type CatalogFetch,
} from "./persona-catalog.ts";

const BASE = "http://localhost:4000";
const CATALOG_URL = `${BASE}/api/personas`;

/** A catalog entry as the API reports one. */
const entry = (overrides: Record<string, unknown> = {}) => ({
  id: "custom-3",
  label: "Custom 3",
  emoji: "✏️",
  defaultPrompt: "Hãy đóng vai một chuyên gia về truyện kiếm hiệp",
  knowledgeTopics: ["truyen-kiem-hiep", "Truyện cười"],
  answerMode: "material",
  ...overrides,
});

/** What the page holds: the built-in list's fields, with the catalog's two
 * optional additions, so one type stands for either source. */
interface TestPersona {
  id: string;
  label: string;
  emoji: string;
  defaultPrompt: string;
  knowledgeTopics?: string[];
  answerMode?: "generate" | "material";
}

/** One persona, with only the fields a test cares about spelled out. */
const persona = (overrides: Partial<TestPersona> & { id: string }): TestPersona => ({
  label: "",
  emoji: "",
  defaultPrompt: "",
  ...overrides,
});

/** The built-in list as the page holds it: the same fields, minus the mode. */
const BUILT_IN: TestPersona[] = [
  { id: "friendly-partner", label: "Friendly Partner", emoji: "🤝", defaultPrompt: "a prompt" },
  { id: "custom-3", label: "Custom 3", emoji: "✏️", defaultPrompt: "another prompt" },
];

interface Recorded {
  url: string;
  method?: string;
  signal?: AbortSignal;
}

/**
 * A stand-in for the catalog endpoint. `hold` keeps the request open until the
 * signal aborts, which is what a real fetch does when the page's timeout fires —
 * and what makes the timeout observable rather than merely attempted.
 */
function fakeBackend(
  options: { status?: number; body?: unknown; throw?: boolean; hold?: boolean } = {}
): { fetch: CatalogFetch; calls: Recorded[] } {
  const { status = 200, body = [entry()], throw: throws = false, hold = false } = options;
  const calls: Recorded[] = [];

  const fetch: CatalogFetch = (url, init) => {
    calls.push({ url, method: init.method, signal: init.signal ?? undefined });
    if (throws) return Promise.reject(new Error("network down"));
    if (hold) {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    }
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    );
  };

  return { fetch, calls };
}

describe("fetchPersonaCatalog", () => {
  it("reads the catalog from the API's route, with a credential-carrying fetch and GET", async () => {
    const backend = fakeBackend({ body: [entry()] });

    const personas = await fetchPersonaCatalog({ fetch: backend.fetch, baseUrl: BASE });

    assert.equal(backend.calls.length, 1);
    assert.equal(backend.calls[0].url, CATALOG_URL);
    assert.equal(backend.calls[0].method, "GET");
    assert.deepEqual(
      personas?.map((persona) => persona.id),
      ["custom-3"]
    );
    assert.equal(personas?.[0].answerMode, "material", "the mode the catalog reports is kept");
    assert.deepEqual(personas?.[0].knowledgeTopics, ["truyen-kiem-hiep", "Truyện cười"]);
  });

  it("reports a catalog it cannot read as nothing, rather than as an empty one", async () => {
    for (const body of ["not an array", {}, [], [{ noId: true }], [null, 7]]) {
      const backend = fakeBackend({ body });
      const personas = await fetchPersonaCatalog({ fetch: backend.fetch, baseUrl: BASE });
      assert.equal(personas, null, `body ${JSON.stringify(body)} must not read as a catalog`);
    }
  });

  it("reports an error status as nothing", async () => {
    const backend = fakeBackend({ status: 401, body: { error: "unauthorized" } });

    assert.equal(await fetchPersonaCatalog({ fetch: backend.fetch, baseUrl: BASE }), null);
  });

  it("reports a failed request as nothing, without rejecting", async () => {
    const backend = fakeBackend({ throw: true });

    assert.equal(await fetchPersonaCatalog({ fetch: backend.fetch, baseUrl: BASE }), null);
  });

  it("gives up waiting at the timeout, so an API that says nothing cannot hold the page", async () => {
    const backend = fakeBackend({ hold: true });

    const started = Date.now();
    const personas = await fetchPersonaCatalog({ fetch: backend.fetch, baseUrl: BASE, timeoutMs: 20 });

    assert.equal(personas, null);
    assert.ok(
      Date.now() - started < 1_000,
      "the timeout must bound the wait rather than the request settling on its own"
    );
    assert.ok(backend.calls[0].signal?.aborted, "the abandoned request must be aborted, not left open");
  });

  it("keeps the usable entries of a catalog that also carries an unusable one", async () => {
    const backend = fakeBackend({ body: [entry(), { label: "no identifier" }, entry({ id: "custom-4" })] });

    const personas = await fetchPersonaCatalog({ fetch: backend.fetch, baseUrl: BASE });

    assert.deepEqual(
      personas?.map((persona) => persona.id),
      ["custom-3", "custom-4"]
    );
  });
});

describe("toCatalogPersona", () => {
  it("defaults every field a persona can render without", () => {
    const persona = toCatalogPersona({ id: "bare" });

    assert.deepEqual(persona, {
      id: "bare",
      label: "",
      emoji: "",
      defaultPrompt: "",
      knowledgeTopics: [],
      answerMode: DEFAULT_ANSWER_MODE,
    });
  });

  it("drops a topic that is not a string, keeping the ones that are", () => {
    const persona = toCatalogPersona({ id: "mixed", knowledgeTopics: ["a", 7, null, "b"] });

    assert.deepEqual(persona?.knowledgeTopics, ["a", "b"]);
  });

  it("refuses anything that is not an object with an identifier", () => {
    for (const raw of [null, undefined, "friendly-partner", 42, [], {}, { id: "" }, { id: 7 }]) {
      assert.equal(toCatalogPersona(raw), null, `${JSON.stringify(raw)} is not a persona`);
    }
  });

  it("parses an empty-string topic list as no topics", () => {
    assert.deepEqual(toCatalogPersona({ id: "x", knowledgeTopics: "truyen-kiem-hiep" })?.knowledgeTopics, []);
  });
});

describe("resolveAnswerMode", () => {
  it("reports a persona that asks for material replies as material", () => {
    assert.equal(resolveAnswerMode("material"), "material");
  });

  it("treats every other value as generating, including nothing at all", () => {
    for (const raw of [undefined, null, "", "generate", "Material", "MATERIAL", 7, {}, ["material"]]) {
      assert.equal(resolveAnswerMode(raw), "generate", `${JSON.stringify(raw)} must generate`);
    }
  });
});

describe("resolvePersona", () => {
  it("resolves against the catalog when it reports the identifier", () => {
    const catalog = [persona({ id: "custom-3", label: "from the catalog" })];

    const found = resolvePersona("custom-3", catalog, BUILT_IN);

    assert.equal(found?.label, "from the catalog");
  });

  it("resolves a catalog entry that carries the fields the built-in list does not", () => {
    const catalog = [
      persona({
        id: "custom-3",
        label: "Custom 3",
        knowledgeTopics: ["truyen-kiem-hiep"],
        answerMode: "material",
      }),
    ];

    const found = resolvePersona("custom-3", catalog, BUILT_IN);

    assert.equal(found?.answerMode, "material", "the whole entry comes back, not only its id");
    assert.deepEqual(found?.knowledgeTopics, ["truyen-kiem-hiep"]);
  });

  it("falls through to the built-in list when the catalog does not report it", () => {
    const found = resolvePersona("friendly-partner", [persona({ id: "custom-3" })], BUILT_IN);

    assert.equal(found?.label, "Friendly Partner");
  });

  it("reports nothing for an identifier neither reports, so the page can default", () => {
    assert.equal(resolvePersona("custom-9", [persona({ id: "custom-3" })], BUILT_IN), undefined);
  });

  it("searches the lists in the order it is given them", () => {
    const found = resolvePersona("custom-3", [], BUILT_IN);

    assert.equal(found?.label, "Custom 3", "an empty catalog must not stop the list being searched");
  });
});
