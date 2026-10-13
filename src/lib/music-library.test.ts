import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { fetchLibrary, type LibraryFetch } from "./music-library.ts";

/** An answer carrying `body`, as the server would send it. */
function answering(body: unknown, status = 200): LibraryFetch {
  return async () =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("reading the music library", () => {
  it("answers the tracks the server holds, in the order it holds them", async () => {
    const outcome = await fetchLibrary(
      "/api/music",
      answering({
        tracks: [
          { title: "Diem Xua", url: "/audio/music/Diem%20Xua.mp3" },
          { title: "Back in Black", url: "/audio/music/Back%20in%20Black.mp3" },
        ],
        report: null,
      })
    );

    assert.deepEqual(
      outcome.tracks.map((track) => track.title),
      ["Diem Xua", "Back in Black"],
      "the order is the shelf's own, and the display is the only thing that has to preserve it"
    );
    assert.equal(outcome.report, null, "there is something to show, so there is nothing to report");
  });

  it("answers a deployment with no music with what the server said, rather than an empty list", async () => {
    const outcome = await fetchLibrary(
      "/api/music",
      answering({ tracks: [], report: "this deployment has no music library" })
    );

    assert.deepEqual(outcome.tracks, []);
    assert.match(
      outcome.report ?? "",
      /no music library/,
      "an empty list reads as a shelf that happens to be empty; the reason is what says otherwise"
    );
  });

  it("answers a refusal as a report, rather than as music", async () => {
    const outcome = await fetchLibrary("/api/music", answering({ error: "Unauthorized" }, 401));

    assert.deepEqual(outcome.tracks, []);
    assert.match(outcome.report ?? "", /HTTP 401/);
  });

  it("answers a body that is not a library as a report, rather than throwing", async () => {
    const outcome = await fetchLibrary("/api/music", answering({ tracks: "not an array" }));

    assert.deepEqual(outcome.tracks, []);
    assert.match(outcome.report ?? "", /no tracks/);
  });

  it("leaves out an entry that is not a track, rather than rendering a broken row", async () => {
    const outcome = await fetchLibrary(
      "/api/music",
      answering({
        tracks: [
          { title: "Diem Xua", url: "/audio/music/Diem%20Xua.mp3" },
          { title: "no url" },
          null,
        ],
        report: null,
      })
    );

    assert.deepEqual(
      outcome.tracks.map((track) => track.title),
      ["Diem Xua"]
    );
  });

  it("answers a server it cannot reach as a report, rather than as an unhandled rejection", async () => {
    const outcome = await fetchLibrary("/api/music", async () => {
      throw new Error("Network request failed");
    });

    assert.deepEqual(outcome.tracks, []);
    assert.match(outcome.report ?? "", /Network request failed/);
  });
});
