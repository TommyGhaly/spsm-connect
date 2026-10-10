/**
 * Italic and bold as buttons rather than as punctuation somebody has to know.
 *
 * ---------------------------------------------------------------------------
 * The church's description fields store the markup `Rich` renders — `*italic*`,
 * `**bold**`, `[text](/path)` — and until now the only way to reach it was to
 * type the asterisks, with a line of small print under every field saying so.
 * Tommy: *"I also want the italicies and bold settings for the text writing."*
 * The website grew the same two buttons for the same reason, and its own note
 * says it best: every affordance that has to be *learned* is one that gets asked
 * about on the phone, and "one asterisk is italic, two are bold" is exactly that.
 *
 * ## Markers, not a rich editor
 *
 * The website's `RichText` is a `contenteditable` that hides the markers and
 * shows bold as bold. There is no `contenteditable` on a phone: a `TextInput` is
 * one run of one style, so the markers have to stay visible and the buttons have
 * to write them. That is the honest version of this control here rather than a
 * lesser one — what is in the box is what is stored, and the field's own hint
 * has always said so.
 *
 * ## It reads the text the way the renderer does
 *
 * Everything below is built on `MARKUP` from `./markup`, which is the same
 * expression `Rich` renders with — so "the caret is inside bold" means the same
 * thing to the toolbar as to the page it will be read on. Two patterns would
 * eventually disagree, and the disagreement would be a lamp lit over text that
 * renders plain.
 *
 * ## The two marks cannot nest, and the toggle says so by swapping
 *
 * `MARKUP` is `\*\*([^*]+)\*\*` and `\*([^*]+)\*` — no asterisk inside either —
 * so `***word***` is not bold italic, it is a parse failure that renders as
 * stray asterisks. Rather than let a button produce that, pressing Bold inside
 * an italic run *replaces* the italic. One mark at a time is what the renderer
 * can say, so it is what the buttons offer.
 * ---------------------------------------------------------------------------
 */
import { MARKUP } from './markup';

/** Which of the two the buttons offer. Links are read but never written here. */
export type Mark = 'italic' | 'bold';

const MARKER: Record<Mark, string> = { italic: '*', bold: '**' };

/** A `TextInput`'s selection: a caret when the two are equal. */
export interface Range {
  start: number;
  end: number;
}

/**
 * One marked-up run, with where its markers are.
 *
 * `parseRuns` in `Rich` answers the neighbouring question — what the runs *say*
 * — and deliberately throws the positions away, because a renderer has no use
 * for them. A toolbar has nothing else: every question it asks is about where
 * the caret is relative to a marker.
 */
interface Span {
  kind: Mark | 'link';
  /** The whole run, markers included. */
  start: number;
  end: number;
  /** The words between the markers. */
  innerStart: number;
  innerEnd: number;
}

function spansOf(source: string): Span[] {
  const spans: Span[] = [];

  for (const match of source.matchAll(MARKUP)) {
    const start = match.index;
    const whole = match[0];

    const kind: Mark | 'link' =
      match[1] !== undefined ? 'bold' : match[2] !== undefined ? 'italic' : 'link';
    const inner = match[1] ?? match[2] ?? match[3] ?? '';
    const innerStart = start + whole.indexOf(inner);

    spans.push({
      kind,
      start,
      end: start + whole.length,
      innerStart,
      innerEnd: innerStart + inner.length,
    });
  }

  return spans;
}

/**
 * The run this selection is working on, if any.
 *
 * Two ways to be "in" a run, and both are needed:
 *
 *  - **Inside its words.** A caret between the markers counts, including one
 *    sitting just before the closing marker — that is where the next keystroke
 *    lands, so it is where the lamp has to be lit. A caret just *after* the
 *    closing marker does not count, because typing there is plain text.
 *  - **Around the whole thing.** Somebody who selects `**word**`, markers and
 *    all, and presses Bold means to take the bold off, not to wrap it again.
 */
function enclosing(source: string, range: Range): Span | null {
  const { start, end } = tidy(source, range);

  return (
    spansOf(source).find(
      (span) =>
        (span.innerStart <= start && end <= span.innerEnd) ||
        (start <= span.start && span.end <= end),
    ) ?? null
  );
}

/**
 * Which mark the caret is inside, for the button's pressed state.
 *
 * Tommy, on the website's version of this: *"if a setting is turned on there
 * should be more indication — for example if bold is on it should let the user
 * know that bold is on."* The markers are visible here, which is half the
 * answer, but a caret at the end of a bold word looks like a caret at the end of
 * a plain one until the next letter comes out heavy.
 *
 * A link reads as neither, rather than as an error: it is a run the buttons do
 * not write and must not quietly unwrap.
 */
export function markAt(source: string, range: Range): Mark | null {
  const span = enclosing(source, range);
  return span === null || span.kind === 'link' ? null : span.kind;
}

/** The text after the button, and where the selection should land in it. */
export interface Marked {
  text: string;
  selection: Range;
}

/**
 * Press a mark on or off.
 *
 * Three outcomes, in the order they are tried:
 *
 *  1. **Already this mark** — the markers come off, and the words stay
 *     selected so a second press puts them back.
 *  2. **The other mark** — they are swapped, because the two cannot nest. See
 *     the header.
 *  3. **Neither** — what is selected is wrapped. With nothing selected that is
 *     an empty pair with the caret between them, which is how somebody turns
 *     bold on and then types.
 *
 * A link is left alone entirely: the selection is wrapped inside it, which is
 * the one case where a nested marker is what somebody asked for and the one the
 * renderer will refuse. It is also the case nobody has hit — links are typed by
 * hand and there is no button for them — so it is not worth a fourth branch
 * that would have to invent an answer.
 */
export function toggleMark(source: string, range: Range, mark: Mark): Marked {
  const { start, end } = tidy(source, range);
  const marker = MARKER[mark];

  /*
   * An empty pair, which is the state a press *leaves behind*, and which
   * `MARKUP` cannot see: both its forms are `[^*]+`, so `****` matches nothing
   * and is not a run at all.
   *
   * Without this, pressing B and then changing your mind and pressing it again
   * gives `********` — measured on a phone, not reasoned about. A button that
   * does not undo itself is the one thing a toggle must not do.
   */
  if (emptyPair(source, start, end, marker)) {
    return {
      text: source.slice(0, start - marker.length) + source.slice(end + marker.length),
      selection: { start: start - marker.length, end: start - marker.length },
    };
  }

  const span = enclosing(source, { start, end });

  if (span !== null && span.kind !== 'link') {
    const inner = source.slice(span.innerStart, span.innerEnd);

    if (span.kind === mark) {
      return {
        text: source.slice(0, span.start) + inner + source.slice(span.end),
        selection: { start: span.start, end: span.start + inner.length },
      };
    }

    return {
      text: source.slice(0, span.start) + marker + inner + marker + source.slice(span.end),
      selection: {
        start: span.start + marker.length,
        end: span.start + marker.length + inner.length,
      },
    };
  }

  const inner = source.slice(start, end);
  return {
    text: source.slice(0, start) + marker + inner + marker + source.slice(end),
    selection: { start: start + marker.length, end: end + marker.length },
  };
}

/**
 * Whether the caret is sitting between a marker and its twin, with nothing in
 * between.
 *
 * Only for a caret — with something selected there is a run to act on and this
 * is not the question. The outward check is what keeps italic out of bold's
 * markers: in `**|**` the character either side *is* an asterisk, and stripping
 * one from each side would leave a stray pair. An empty italic pair is
 * `*|*` with something that is not an asterisk beyond it on both sides.
 */
function emptyPair(source: string, start: number, end: number, marker: string): boolean {
  if (start !== end) return false;

  const len = marker.length;
  if (source.slice(start - len, start) !== marker) return false;
  if (source.slice(end, end + len) !== marker) return false;

  return source[start - len - 1] !== '*' && source[end + len] !== '*';
}

/**
 * A selection that is certainly inside the text and the right way round.
 *
 * Not defensive programming for its own sake: a `TextInput` whose value has just
 * been replaced from underneath — which is what every one of these buttons does
 * — reports the *old* selection for a frame on Android, and that one can be past
 * the end of the new string. Clamping is the difference between a marker in the
 * wrong place and a marker somewhere that does not exist.
 */
function tidy(source: string, range: Range): Range {
  const limit = source.length;
  const a = Math.min(Math.max(range.start, 0), limit);
  const b = Math.min(Math.max(range.end, 0), limit);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}
