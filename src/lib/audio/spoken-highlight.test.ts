/**
 * Placing a spoken segment in the message it came from. Run with Node's runner:
 *
 *   node --test src/lib/audio/spoken-highlight.test.ts
 *
 * What this suite pins is the rule the transcript's highlight rests on: the
 * segment now playing is found in the message as the page still holds it — raw,
 * markdown and all — and a segment that cannot be found is answered as `null`
 * rather than guessed at. The page draws no highlight in that case, which is the
 * failure this rule is chosen for: an unhighlighted reply is a smaller lie than
 * a highlight in the wrong place.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collapseForSearch,
  locateSpokenSegment,
  withSegmentMarks,
  withSpokenHighlight,
} from "./spoken-highlight.ts";

/** The segments of one reply, as the server's stream would number them. */
function segments(...texts: string[]): Map<number, string> {
  return new Map(texts.map((text, index) => [index, text]));
}

describe("locating the segment being spoken", () => {
  it("finds each segment of a single-line reply, in turn", () => {
    const content = "Chào bạn. Tôi khỏe, cảm ơn bạn đã hỏi.";
    const spoken = segments("Chào bạn.", "Tôi khỏe, cảm ơn bạn", "đã hỏi.");

    assert.deepEqual(locateSpokenSegment(content, spoken, 0), { start: 0, end: 9 });
    assert.deepEqual(locateSpokenSegment(content, spoken, 1), { start: 10, end: 30 });
    assert.deepEqual(locateSpokenSegment(content, spoken, 2), { start: 31, end: 38 });
    assert.equal(content.slice(10, 30), "Tôi khỏe, cảm ơn bạn");
  });

  it("finds a segment across the paragraph break the server collapsed", () => {
    // The server turns every newline into a space before it splits, and packs
    // neighbouring sentences into one utterance while they fit — so a reply
    // written as two paragraphs can arrive as one segment holding a space where
    // the page holds a break. Searching the raw text would miss it.
    const content = "Câu hỏi đầu tiên.\n\nCâu hỏi thứ hai.";
    const spoken = segments("Câu hỏi đầu tiên. Câu hỏi thứ hai.");

    assert.ok(
      !content.includes("Câu hỏi đầu tiên. Câu hỏi thứ hai."),
      "the segment must not be a substring of the raw text, or this proves nothing"
    );
    assert.deepEqual(locateSpokenSegment(content, spoken, 0), { start: 0, end: 35 });
  });

  it("keeps a repeated phrase on its own occurrence", () => {
    // Each segment is searched from the end of the one before it, which is what
    // keeps a phrase that recurs later in the reply from pulling the highlight
    // back to an earlier occurrence.
    const content = "Rất tốt. Bạn giải thích rõ. Rất tốt.";
    const spoken = segments("Rất tốt.", "Bạn giải thích rõ.", "Rất tốt.");

    assert.deepEqual(locateSpokenSegment(content, spoken, 0), { start: 0, end: 8 });
    assert.deepEqual(locateSpokenSegment(content, spoken, 1), { start: 9, end: 27 });
    assert.deepEqual(locateSpokenSegment(content, spoken, 2), { start: 28, end: 36 });
  });

  it("stops highlighting at the markdown it cannot match, and not before", () => {
    // The stripper removes the markers rather than the words, so a segment the
    // markers sit inside no longer appears in the reply the page holds. The
    // segments before it are still placed — the walk only ever looks backwards —
    // and the one that cannot be is answered as null, which is no highlight.
    const content = "Câu hỏi một. **Câu hỏi** hai.";
    const spoken = segments("Câu hỏi một.", "Câu hỏi hai.");

    assert.deepEqual(locateSpokenSegment(content, spoken, 0), { start: 0, end: 12 });
    assert.equal(locateSpokenSegment(content, spoken, 1), null);
  });

  it("answers null rather than guessing when a segment cannot be found", () => {
    const spoken = segments("một hai ba", "bốn năm");
    assert.equal(
      locateSpokenSegment("một hai ba sáu bảy", spoken, 1),
      null,
      "a rewording the stripper could have produced must not be searched for loosely"
    );
  });

  it("answers null when the walk has a gap in it", () => {
    const spoken = new Map<number, string>([
      [0, "một"],
      [2, "ba"],
    ]);
    assert.equal(
      locateSpokenSegment("một hai ba", spoken, 2),
      null,
      "a missing index would place everything after it on a cursor that never reached the truth"
    );
  });

  it("answers null before anything has been spoken", () => {
    assert.equal(locateSpokenSegment("một hai", segments("một"), -1), null);
  });
});

describe("collapsing whitespace for the search", () => {
  it("turns every run of whitespace into one space, and points each back", () => {
    const source = "một\n\nhai   ba";
    const { text, origin } = collapseForSearch(source);

    assert.equal(text, "một hai ba");
    assert.deepEqual(
      origin.map((at) => source[at]),
      ["m", "ộ", "t", "\n", "h", "a", "i", " ", "b", "a"]
    );
  });

  it("drops leading and trailing whitespace, and points every kept character", () => {
    const source = "  một hai  ";
    const { text, origin } = collapseForSearch(source);

    assert.equal(text, "một hai");
    assert.equal(origin.length, text.length);
    assert.equal(source[origin[0]], "m");
    assert.equal(source[origin[origin.length - 1]], "i");
  });
});

describe("marking the located segment", () => {
  it("wraps exactly the range it was given and leaves the rest alone", () => {
    const marked = withSpokenHighlight("một hai ba", { start: 4, end: 7 });

    assert.match(marked, /^một <mark class="[^"]+">hai<\/mark> ba$/);
  });

  it("marks each paragraph of a range that straddles a blank line", () => {
    // One <mark> across the break does not survive rendering: the tag is inline,
    // the blank line closes the paragraph the parser has open, and the mark is
    // closed with it — the second paragraph is then read aloud unlit. So the
    // range is split on the break, and the break is left outside the marks.
    const marked = withSpokenHighlight("Câu hỏi đầu tiên.\n\nCâu hỏi thứ hai.", {
      start: 0,
      end: 35,
    });

    assert.match(
      marked,
      /^<mark class="[^"]+">Câu hỏi đầu tiên\.<\/mark>\n\n<mark class="[^"]+">Câu hỏi thứ hai\.<\/mark>$/
    );
    assert.equal((marked.match(/<mark/g) ?? []).length, 2);
  });

  it("never wraps whitespace alone, however long the break is", () => {
    const marked = withSpokenHighlight("một\n\n\nhai", { start: 0, end: 9 });

    assert.match(
      marked,
      /^<mark class="[^"]+">một<\/mark>\n\n\n<mark class="[^"]+">hai<\/mark>$/
    );
    assert.equal(
      (marked.match(/<mark class="[^"]*">\s*<\/mark>/g) ?? []).length,
      0,
      "an empty mark would paint a blank strip where the break is"
    );
  });

  it("leaves a soft break inside the mark, which is the one the reader sees", () => {
    // A single newline is a line break, not a paragraph one, and marked turns it
    // into a <br> inside the mark — so the whole segment stays one highlight.
    const marked = withSpokenHighlight("Câu một.\nCâu hai.", { start: 0, end: 17 });

    assert.match(marked, /^<mark class="[^"]+">Câu một\.\nCâu hai\.<\/mark>$/);
  });
});

describe("marking the parts of a reply that were never spoken", () => {
  /** The classes the marks carry, in the order they appear. */
  function classes(marked: string): string[] {
    return [...marked.matchAll(/<mark class="([^"]+)"/g)].map((match) => match[1]);
  }

  it("marks a segment that produced no audio, with no playback running", () => {
    // A failed segment is stepped over, so no playback position ever names it —
    // the mark is all the listener has to go on, and it has to be drawn even
    // when the queue is idle.
    const spoken = segments("Một.", "Hai.", "Ba.");

    const marked = withSegmentMarks("Một. Hai. Ba.", spoken, -1, [1]);

    assert.match(marked, /^Một\. <mark class="[^"]+">Hai\.<\/mark> Ba\.$/);
  });

  it("marks the playing segment and the unspoken one in one pass", () => {
    const spoken = segments("Một.", "Hai.", "Ba.");

    const marked = withSegmentMarks("Một. Hai. Ba.", spoken, 2, [1]);

    assert.match(
      marked,
      /^Một\. <mark class="[^"]+">Hai\.<\/mark> <mark class="[^"]+">Ba\.<\/mark>$/
    );
  });

  it("tells the unspoken mark apart from the playing one", () => {
    // An unspoken segment is not a moment in the playback, so a mark that looked
    // like the amber one would read as "being read now" — the opposite of true.
    const spoken = segments("Một.", "Hai.", "Ba.");

    const found = classes(withSegmentMarks("Một. Hai. Ba.", spoken, 2, [1]));

    assert.equal(found.length, 2);
    assert.notEqual(found[0], found[1]);
  });

  it("places every unspoken mark against the original text, not against each other", () => {
    // Each range is found in the reply as it stands and applied back to front:
    // marking the earlier one first would move every offset after it, and the
    // later mark would land on whatever had shifted into its place.
    const spoken = segments("Một.", "Hai.", "Ba.", "Bốn.");

    const marked = withSegmentMarks("Một. Hai. Ba. Bốn.", spoken, -1, [0, 2]);

    assert.match(
      marked,
      /^<mark class="[^"]+">Một\.<\/mark> Hai\. <mark class="[^"]+">Ba\.<\/mark> Bốn\.$/
    );
    assert.equal(classes(marked).length, 2);
  });

  it("leaves an unspoken segment unmarked when it cannot be placed", () => {
    // The rule the playing segment is held to, and for the same reason: a mark
    // in the wrong place is a bigger lie than no mark.
    const spoken = segments("một hai ba", "bốn năm");

    assert.equal(
      withSegmentMarks("một hai ba sáu bảy", spoken, -1, [1]),
      "một hai ba sáu bảy"
    );
  });

  it("leaves the reply untouched when nothing is playing and nothing failed", () => {
    const spoken = segments("Một.", "Hai.");

    assert.equal(withSegmentMarks("Một. Hai.", spoken, -1, []), "Một. Hai.");
  });
});
