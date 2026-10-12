/**
 * Placing the segment being spoken inside the message it came from.
 *
 * The transcript page hands the speaker a message's text and gets back one
 * `sentence` event per spoken segment — the server's own chunk of
 * `stripMarkdown(text)`. This module answers the other half: which slice of the
 * message, as the page still holds it, the segment now playing covers, so the
 * page can mark it without hiding anything.
 *
 * The two texts are not identical. The server strips markdown and collapses
 * every run of whitespace to a single space before it splits; the page holds the
 * raw reply. `collapseForSearch` closes the whitespace half of that gap — which
 * is the half that matters, because an answer written as paragraphs would
 * otherwise never match — and a markdown marker the stripper rewrote rather than
 * removed makes the search miss, which is answered as `null` and drawn as no
 * highlight rather than as a wrong one.
 */

/** A half-open range of the original text. */
export interface SegmentRange {
  start: number;
  end: number;
}

/** The mark's own styling, kept beside the tag that carries it. */
const MARK_CLASS =
  "rounded-sm bg-amber-200 text-zinc-900 dark:bg-amber-500/40 dark:text-zinc-50";

/**
 * The mark for a segment that produced no audio — the part of a reply the
 * listener never heard.
 *
 * It reads as a warning rather than as a position, because it is not a moment in
 * the playback: a segment with no audio is stepped over, so there is no instant
 * at which it is "now being read". It is styled to be told apart from the amber
 * mark at a glance.
 */
const UNSPOKEN_CLASS =
  "rounded-sm bg-red-100 text-red-900 underline decoration-red-400 dark:bg-red-500/30 dark:text-red-50";

/**
 * Where the segment at `currentIndex` sits in `content`, or `null` when it
 * cannot be placed.
 *
 * Segments are walked from index 0 because each one is only locatable after the
 * one before it: the cursor that `indexOf` starts from is what keeps a phrase
 * repeated later in the reply from matching an earlier occurrence. A gap — an
 * index with no text recorded, or a segment the search cannot find — answers
 * `null` for the whole walk, since everything after it would be placed on a
 * cursor that never reached the truth.
 */
export function locateSpokenSegment(
  content: string,
  segments: Map<number, string>,
  currentIndex: number
): SegmentRange | null {
  const collapsed = collapseForSearch(content);
  let cursor = 0;

  for (let index = 0; index <= currentIndex; index++) {
    const segment = segments.get(index);
    if (segment === undefined || segment === "") return null;

    const start = collapsed.text.indexOf(segment, cursor);
    if (start === -1) return null;

    cursor = start + segment.length;
    if (index === currentIndex) {
      // Mapped back to the original text, which is what gets rendered. The last
      // collapsed character of a segment is never one of the synthetic spaces,
      // because a chunk arrives trimmed.
      return { start: collapsed.origin[start], end: collapsed.origin[cursor - 1] + 1 };
    }
  }

  return null;
}

/**
 * `content` with every run of whitespace collapsed to one space, and, for each
 * character of the result, the index in `content` it came from.
 *
 * The collapse mirrors what the server's `stripMarkdown` ends with
 * (`.replace(/\n/g, " ").replace(/\s+/g, " ").trim()`), so the text the segments
 * were cut from and the text searched here agree on their whitespace. Leading
 * whitespace and a trailing run produce nothing, which is that `trim()`.
 */
export function collapseForSearch(content: string): { text: string; origin: number[] } {
  let text = "";
  const origin: number[] = [];
  /** Index of the first character of the whitespace run now pending, or -1. */
  let pendingSpace = -1;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (/\s/.test(char)) {
      if (text !== "" && pendingSpace === -1) pendingSpace = i;
      continue;
    }
    if (pendingSpace !== -1) {
      text += " ";
      origin.push(pendingSpace);
      pendingSpace = -1;
    }
    text += char;
    origin.push(i);
  }

  return { text, origin };
}

/**
 * `content` with `range` wrapped in a `<mark>` — the shape the page's markdown
 * renderer can take, since it parses HTML that `marked` passes through and
 * `DOMPurify` keeps (`mark` is in its default allow-list, `class` is allowed
 * here).
 *
 * A range can straddle a paragraph break, because the server collapses newlines
 * before it splits and packs neighbouring sentences into one utterance — so a
 * reply written as two short paragraphs arrives as a single segment. One `<mark>`
 * spanning the break does not survive being rendered: the tag is inline, the
 * blank line ends the paragraph the parser has open, and the mark is closed with
 * it, leaving the rest of the segment read aloud but unhighlighted. Each
 * paragraph of the range therefore gets its own mark, and the separators stay
 * outside them.
 */
export function withSpokenHighlight(content: string, range: SegmentRange): string {
  return wrapRange(content, range, MARK_CLASS);
}

/**
 * `part` with each paragraph's non-whitespace core wrapped in one mark, and the
 * separators left outside them.
 *
 * A part can straddle a paragraph break, because the server collapses newlines
 * before it splits and packs neighbouring sentences into one utterance — so a
 * reply written as two short paragraphs arrives as a single segment. One `<mark>`
 * spanning the break does not survive being rendered: the tag is inline, the
 * blank line ends the paragraph the parser has open, and the mark is closed with
 * it, leaving the rest of the segment read aloud but unmarked. Each paragraph
 * therefore gets its own mark.
 */
function wrapParagraphs(part: string, className: string): string {
  /** Never a mark around whitespace alone. */
  const wrap = (paragraph: string): string => {
    const core = paragraph.trim();
    if (core === "") return paragraph;
    const at = paragraph.indexOf(core);
    return (
      paragraph.slice(0, at) +
      `<mark class="${className}">${core}</mark>` +
      paragraph.slice(at + core.length)
    );
  };

  return part.split(/(\n[ \t]*\n)/).map(wrap).join("");
}

/** `content` with `range` marked in `className`. */
function wrapRange(content: string, range: SegmentRange, className: string): string {
  return (
    content.slice(0, range.start) +
    wrapParagraphs(content.slice(range.start, range.end), className) +
    content.slice(range.end)
  );
}

/**
 * `content` with the segment now playing marked, and with every segment that
 * produced no audio marked as the part that was not spoken.
 *
 * Both sets of marks are placed against the **same** original content and then
 * applied back to front, because wrapping one range moves every offset after it.
 * Marking the spoken segment and then searching for an unspoken one would place
 * the second on offsets the first had already shifted.
 */
export function withSegmentMarks(
  content: string,
  segments: Map<number, string>,
  currentIndex: number,
  unspoken: readonly number[]
): string {
  const spoken = currentIndex >= 0 ? locateSpokenSegment(content, segments, currentIndex) : null;

  if (unspoken.length === 0) {
    return spoken ? withSpokenHighlight(content, spoken) : content;
  }

  const ranges: { range: SegmentRange; className: string }[] = [];
  if (spoken) ranges.push({ range: spoken, className: MARK_CLASS });
  for (const index of unspoken) {
    const range = locateSpokenSegment(content, segments, index);
    if (range) ranges.push({ range, className: UNSPOKEN_CLASS });
  }

  ranges.sort((a, b) => b.range.start - a.range.start);

  let marked = content;
  for (const { range, className } of ranges) {
    marked = wrapRange(marked, range, className);
  }
  return marked;
}
