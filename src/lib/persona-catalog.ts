/**
 * The client half of the persona catalog (design.md D10).
 *
 * The page offers personas from the API and falls back to its built-in list when
 * the catalog cannot be read, and a deep link has to resolve against either. That
 * is two things needing to be reasoned about in one place — what a catalog
 * response has to look like to be usable, and which list an identifier resolves
 * against — so they live here rather than inline in the page.
 *
 * Like `voice-prefetch.ts`, this module takes its `fetch` and base URL as
 * parameters and imports no values, so it runs under Node's own test runner with
 * no framework, no bundler and no browser.
 */

/** How a persona's replies are produced: by the model, or read from the material
 * its topics scope. Mirrors the server's own type (`src/lib/personas.ts`). */
export type AnswerMode = "generate" | "material";

/** The mode a persona without one is treated as. Named rather than repeated, so
 * the fold below and the page's default agree on the string. */
export const DEFAULT_ANSWER_MODE: AnswerMode = "generate";

/**
 * How long the page waits for the catalog before serving its built-in list.
 *
 * Bounded rather than left to the browser's own timeout: the load gates the
 * page's first render of a persona and its auto-start, so an API that accepts a
 * connection and then says nothing would hold the page at "starting" for as long
 * as the socket allows. Overridable through
 * `NEXT_PUBLIC_PERSONA_CATALOG_TIMEOUT_MS`, and short by default because the
 * fallback is good: the same personas the catalog now seeds.
 */
export const DEFAULT_CATALOG_TIMEOUT_MS = 3_000;

/** The fields resolution needs: an identifier is all an id can be matched on. */
export interface Identified {
  id: string;
}

/** One persona as the catalog reports it, with every field the page reads
 * present — a catalog entry is complete where the built-in list's topics are
 * optional. */
export interface CatalogPersona {
  id: string;
  label: string;
  emoji: string;
  defaultPrompt: string;
  knowledgeTopics: string[];
  answerMode: AnswerMode;
}

/** The fetch this module calls: the page's authenticated wrapper. */
export type CatalogFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface PersonaCatalogOptions {
  /** The authenticated fetch (`apiFetch`), so the catalog is read with the same
   * credential every other API resource is read with. */
  fetch: CatalogFetch;
  /** The backend origin, without the route path. */
  baseUrl: string;
  /** How long to wait for a usable answer. Defaults to
   * `DEFAULT_CATALOG_TIMEOUT_MS`. */
  timeoutMs?: number;
}

/**
 * Fold a reported answer mode to the one this client acts on.
 *
 * Only the material mode is anything other than generating, which is not a
 * fallback for a malformed value so much as the true answer for one: the server
 * reads material only when a persona asks for it by name, so a persona whose mode
 * is missing or unrecognised generates every reply it will ever produce. The same
 * fold the server performs, on the same value — the mode travels from the catalog
 * to the turn's request unchanged, so the two ends have to agree on what it says.
 */
export function resolveAnswerMode(raw: unknown): AnswerMode {
  return raw === "material" ? "material" : DEFAULT_ANSWER_MODE;
}

/** A non-empty string, or `""` — the client renders what it is told rather than
 * inventing a placeholder, which would look like real content. */
function asText(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

/** The topics a catalog entry declares, dropping anything that is not a string:
 * a topic list is what the session scopes its knowledge by, so a non-string in it
 * is a value the page could not render or send. */
function asTopics(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((topic): topic is string => typeof topic === "string") : [];
}

/**
 * One entry of a catalog response, or nothing when it cannot be a persona.
 *
 * An entry without an identifier is dropped rather than repaired: the id is what
 * a session is started as and what a deep link resolves against, and there is no
 * value this could substitute. Every other field is defaulted, because a client
 * that renders a persona with a missing label is still usable while one that
 * refuses the whole catalog over it is not.
 */
export function toCatalogPersona(raw: unknown): CatalogPersona | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  if (typeof entry.id !== "string" || !entry.id) return null;

  return {
    id: entry.id,
    label: asText(entry.label),
    emoji: asText(entry.emoji),
    defaultPrompt: asText(entry.defaultPrompt),
    knowledgeTopics: asTopics(entry.knowledgeTopics),
    answerMode: resolveAnswerMode(entry.answerMode),
  };
}

/**
 * A catalog response body as personas, or nothing when it is not one.
 *
 * `null` means "this client cannot use that answer", which is the one thing the
 * caller needs to distinguish from a usable catalog: every unusable answer —
 * a body that is not an array, an array whose entries are all unusable, an empty
 * array — reads identically to the page, and it falls back to its built-in list.
 *
 * An **empty** array is treated as unusable rather than as an authoritative "no
 * personas": a catalog is seeded with the schema, so a deployment that reports
 * none is broken rather than deciding to offer none, and the page would otherwise
 * render no options and start no session. The trade is deliberate — the built-in
 * list is the same set the catalog seeds, so falling back cannot offer a persona
 * the platform does not have.
 */
export function parseCatalog(body: unknown): CatalogPersona[] | null {
  if (!Array.isArray(body)) return null;
  const personas = body.map(toCatalogPersona).filter((persona): persona is CatalogPersona => !!persona);
  return personas.length ? personas : null;
}

/**
 * Read the persona catalog, or nothing.
 *
 * Never throws and never rejects: the page awaits this before it renders a
 * persona, and an API that is down must not be a page that fails to load. Both
 * the timeout and the abort are reported as `null`, which the page cannot tell
 * apart from a malformed answer — nor needs to, since the same built-in list
 * answers all of them.
 */
export async function fetchPersonaCatalog(
  options: PersonaCatalogOptions
): Promise<CatalogPersona[] | null> {
  const { fetch, baseUrl, timeoutMs = DEFAULT_CATALOG_TIMEOUT_MS } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/personas`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`[PersonaCatalog] the catalog answered ${response.status}; using the built-in list`);
      return null;
    }
    const body: unknown = await response.json();
    const personas = parseCatalog(body);
    if (!personas) {
      console.warn("[PersonaCatalog] the catalog answered with a body this client cannot read; using the built-in list");
    }
    return personas;
  } catch (err) {
    const reason = controller.signal.aborted ? `no answer within ${timeoutMs}ms` : "the request failed";
    console.warn(`[PersonaCatalog] ${reason}; using the built-in list`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The persona an identifier names, from the first list that reports it.
 *
 * The lists are searched in the order they are given, which is what makes "the
 * catalog first, the built-in list second" a property of the call rather than of
 * the caller — and what lets a deep link resolve against a catalog that does not
 * carry it while the page is showing one that does.
 */
export function resolvePersona<T extends Identified>(
  id: string,
  ...lists: ReadonlyArray<readonly T[]>
): T | undefined {
  for (const list of lists) {
    const found = list.find((persona) => persona.id === id);
    if (found) return found;
  }
  return undefined;
}
