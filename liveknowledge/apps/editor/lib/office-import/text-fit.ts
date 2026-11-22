// How big an imported text box must be to show its words (docs/specs/020-import-export/office-import.md "Text boxes
// and placeholders"). PowerPoint sizes a `wrap="none"` box to its text and an `spAutoFit` box to its height, so the
// size the file states is only a start; the import has no DOM to measure with, so it estimates from the text size,
// on the generous side so no word ends up cut off. Pure, and linear in the text.

// The average glyph advance as a share of the text size (a little over a sans face's, bold wider), and the text
// box's line height and padding as the editor lays them (text-hug.ts).
const GLYPH_EM = 0.58;
const BOLD_EM = 1.08;
const LEADING = 1.25;
const PAD_X = 4;
const PAD_Y = 2;

export type FitBox = { x: number; y: number; width: number; height: number };

export type FitText = { label: string; px: number; bold: boolean };

export type FitRules = { noWrap: boolean; autoFit: boolean };

/** The lines `line` takes at `chars` characters a line: whole words, a longer word broken across lines. */
function wrappedLines(line: string, chars: number): number {
  let lines = 1;
  let used = 0;
  let word = 0;
  const end = () => {
    if (word === 0) return;
    if (word > chars) {
      // A word wider than a line fills whole lines, then carries on from what is left.
      if (used > 0) lines += 1;
      lines += Math.ceil(word / chars) - 1;
      used = word % chars === 0 ? chars : word % chars;
    } else if (used === 0) used = word;
    else if (used + 1 + word <= chars) used += 1 + word;
    else {
      lines += 1;
      used = word;
    }
    word = 0;
  };
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ' ') end();
    else word += 1;
  }
  end();
  return lines;
}

/** The box a text takes on its page: a no-wrap box widened to its longest line (kept on the page, wrapping only
 *  when the page cannot hold it), and a box that sizes to its text, or had to wrap, grown to the height of its lines.
 *  A box never shrinks. */
export function fitTextBox(
  box: FitBox,
  text: FitText,
  rules: FitRules,
  page: Pick<FitBox, 'x' | 'width'>,
): { width: number; height: number } {
  if (!rules.noWrap && !rules.autoFit) return { width: box.width, height: box.height };
  const lines = text.label.split('\n');
  const glyph = text.px * GLYPH_EM * (text.bold ? BOLD_EM : 1);
  let width = box.width;
  let wrapped = false;
  if (rules.noWrap) {
    let longest = 0;
    for (const line of lines) longest = Math.max(longest, line.length);
    const want = Math.ceil(longest * glyph) + 2 * PAD_X;
    // Widened, but not past the page's edge: there it wraps instead.
    const room = Math.max(box.width, Math.floor(page.x + page.width - box.x));
    width = Math.max(box.width, Math.min(want, room));
    wrapped = want > width;
  }
  if (!rules.autoFit && !wrapped) return { width, height: box.height };
  const chars = Math.max(1, Math.floor((width - 2 * PAD_X) / glyph));
  let count = 0;
  for (const line of lines) count += rules.noWrap && !wrapped ? 1 : wrappedLines(line, chars);
  const height = Math.ceil(count * text.px * LEADING) + 2 * PAD_Y;
  return { width, height: Math.max(box.height, height) };
}
