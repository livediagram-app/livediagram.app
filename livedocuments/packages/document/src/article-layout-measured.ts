// An article's lines broken as the browser breaks them (docs/specs/007-editor/flashcards.md "Long stacks stay
// quick"): where the estimate runs in a browser (an unmounted flashcard's writing in an export, a thumbnail or the
// Map), each word is measured in its own face, size and weight, and the lines break as app/article-pages.css breaks
// them (white-space: pre-wrap, overflow-wrap: break-word): at spaces and after a hyphen inside a word, a word wider
// than the line alone broken at the last character that fits. Without a measure the estimate keeps its average glyph
// (wrapEstimated). Pure: the measuring is the caller's.

import type { Style } from './article-layout-set';

/** A text's advance in px drawn in `font` (a CSS font shorthand), as a canvas's measureText reads it. `wordByWord`
 *  says how the browser fits a line: WebKit adds its words' widths up, word by word; Blink and Gecko measure the line
 *  whole, the kerning between its words counted. The two differ by a fraction of a px, enough to move a word on a
 *  line that only just fits. */
export type ArticleTextMeasure = ((text: string, font: string) => number) & {
  wordByWord?: boolean;
};

/** How a block's characters are drawn: the CSS font for a character's style, and the block's letter spacing in em. */
export type MeasuredSet = { fontOf: (s: Style) => string; px: number; tracking: number };

// A line may run this far past its width and still fit: the browser lays out in fractional px, the canvas measures
// them, and a sum of words can round a hair over a line the browser keeps.
const FIT_SLACK_PX = 0.01;

const PLAIN: Style = { b: false, i: false };

// A hyphen inside a word ("well-known", "1990-2020") is a place the browser may break the line, after it; one that
// starts a word ("-5") or ends one is not.
const breaksAfter = (before: string | undefined, after: string | undefined) =>
  !!before && before !== '-' && !!after && after !== ' ' && after !== '-';

/** The lines `text` breaks into at `width` px, each character drawn in its style (`styles`, one per character). */
export function wrapMeasured(
  text: string,
  styles: readonly Style[],
  width: number,
  set: MeasuredSet,
  measure: ArticleTextMeasure,
): string[] {
  // The advance of text.slice(from, to): each stretch of one style measured in its own face.
  const advance = (from: number, to: number): number => {
    let w = 0;
    let start = from;
    for (let k = from + 1; k <= to; k++) {
      const a = styles[start] ?? PLAIN;
      const b = styles[k] ?? PLAIN;
      if (k < to && a.b === b.b && a.i === b.i) continue;
      w += measure(text.slice(start, k), set.fontOf(a));
      start = k;
    }
    return w + set.tracking * set.px * (to - from);
  };
  const out: string[] = [];
  let offset = 0;
  for (const para of text.split('\n')) {
    let line = '';
    // Where the line starts in `text`, for a line measured whole.
    let lineStart = offset;
    let lineW = 0;
    let i = 0;
    while (i < para.length) {
      if (para[i] === ' ') {
        i++;
        continue;
      }
      // The next piece: a word, or a word's part up to and with a hyphen inside it. `glued` joins it to the
      // line without a space (the part after a hyphen).
      const glued = i > 0 && para[i - 1] !== ' ';
      let end = i;
      while (end < para.length && para[end] !== ' ') {
        end++;
        if (para[end - 1] === '-' && end - 1 > i && breaksAfter(para[end - 2], para[end])) break;
      }
      const piece = para.slice(i, end);
      const withPiece = !line
        ? 0
        : measure.wordByWord
          ? lineW +
            (glued ? 0 : advance(offset + i - 1, offset + i)) +
            advance(offset + i, offset + end)
          : advance(lineStart, offset + end);
      if (line && withPiece <= width + FIT_SLACK_PX) {
        line += (glued ? '' : ' ') + piece;
        lineW = withPiece;
      } else {
        if (line) out.push(line);
        line = piece;
        lineStart = offset + i;
        lineW = advance(lineStart, offset + end);
      }
      // A piece wider than a line alone breaks at the last character that fits (overflow-wrap: break-word).
      while (lineW > width + FIT_SLACK_PX && line.length > 1) {
        const from = lineStart;
        let cut = 1;
        let w = advance(from, from + 1);
        while (cut < line.length - 1) {
          const next = w + advance(from + cut, from + cut + 1);
          if (next > width + FIT_SLACK_PX) break;
          w = next;
          cut++;
        }
        out.push(line.slice(0, cut));
        line = line.slice(cut);
        lineStart = from + cut;
        // Measuring the whole rest of a 50,000-character word after every cut made the break quadratic: a prefix of
        // the rest twice the cut's length already wider than the line says it breaks again. The rest is measured
        // whole only once it is that short, or when the prefix fits (a measure that narrows a longer text).
        const rest = offset + end;
        const probe = Math.min(rest, lineStart + 2 * cut + 2);
        lineW = advance(lineStart, probe);
        if (probe < rest && lineW <= width + FIT_SLACK_PX) lineW = advance(lineStart, rest);
      }
      i = end;
    }
    out.push(line);
    offset += para.length + 1;
  }
  return out;
}
