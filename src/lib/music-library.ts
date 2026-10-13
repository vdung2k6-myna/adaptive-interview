/**
 * The deployment's music library, as this client reads it.
 *
 * The server answers one shape: the tracks it holds, or a `report` saying why there is nothing to play.
 * That second half is the interesting one — a deployment with no music is a different answer from a
 * shelf that happens to be empty — so it lives here rather than in the page, where it can be read and
 * asserted without a browser.
 *
 * **The tracks are named and addressed, and not numbered.** A number is the handle a model needs
 * because it will not reproduce a string faithfully; a client reproduces one exactly, and plays by the
 * URL it was shown — the same handle the `music` event carries, fetched by the queue with the same
 * credential this read uses.
 */

/** The page's authenticated fetch, injected so a test needs no credential and no server. */
export type LibraryFetch = (url: string) => Promise<Response>;

/** One track as the server offers it. */
export interface LibraryTrack {
  title: string;
  url: string;
}

/** What the library answered, as the display needs it. */
export interface LibraryOutcome {
  /** The tracks the deployment holds, in the order the server holds them. Empty when there are none. */
  tracks: LibraryTrack[];
  /**
   * What to tell the person when there is nothing to show: why there is nothing to play, or why the
   * library could not be read. `null` exactly when `tracks` is what to show.
   *
   * One field rather than two, because the display does the same thing with either and the difference
   * between them is in the words, not in the handling.
   */
  report: string | null;
}

/** Whether an entry of the server's answer is a track at all. */
function isTrack(entry: unknown): entry is LibraryTrack {
  const candidate = entry as Partial<LibraryTrack> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.title === "string" &&
    typeof candidate.url === "string"
  );
}

/**
 * Read the library, and answer with what to show.
 *
 * Never throws and never rejects: everything that can go wrong — an unreachable server, a refusal, a
 * body that is not the shape above — comes back as a `report`, because a person who asked to see the
 * music is owed a sentence rather than a broken screen.
 */
export async function fetchLibrary(url: string, doFetch: LibraryFetch): Promise<LibraryOutcome> {
  try {
    const res = await doFetch(url);
    if (!res.ok) {
      return { tracks: [], report: `the music library could not be read (HTTP ${res.status})` };
    }

    const answer = (await res.json()) as { tracks?: unknown; report?: unknown };
    const tracks = Array.isArray(answer.tracks) ? answer.tracks.filter(isTrack) : [];
    const report = typeof answer.report === "string" && answer.report !== "" ? answer.report : null;

    if (tracks.length === 0) {
      // The server says why it has nothing; a server that says nothing and offers nothing is still
      // owed an answer, and "no tracks" is the truthful one.
      return { tracks: [], report: report ?? "the music library answered with no tracks" };
    }

    return { tracks, report: null };
  } catch (err) {
    return {
      tracks: [],
      report: err instanceof Error ? err.message : "the music library could not be read",
    };
  }
}
