// A retired element's placeholder (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements"), laid out
// once for every surface that draws it: the export and the thumbnail (svg-render-retired.ts) and the editor's canvas
// face. A plain card in the element's own box: a dashed outline, a muted fill, the kind's name centred, "No longer
// supported in livehuddle" smaller beneath it, and the stored label beneath that when there is one. Pure: the caller places the
// card at the element's position and draws it in its own medium.

import type { CanvasSurface } from './colors';
import { RETIRED_ELEMENT_NOTE, retiredElementName } from './retired-kinds';
import { fitLine } from './svg-render-face-kit';

/** The card's muted colours on each paper: the outline and the words in the surface's ink, quietened, over a fill a
 *  step off the paper, so the card reads as "something was here" and never as content. */
export const RETIRED_PLACEHOLDER_COLOURS: Readonly<
  Record<CanvasSurface, { fill: string; stroke: string; ink: string }>
> = {
  light: { fill: '#f1f5f9', stroke: '#94a3b8', ink: '#475569' },
  dark: { fill: '#1c2533', stroke: '#64748b', ink: '#cbd5e1' },
};

/** One line of the card's words: its text (already cut to fit), its size and weight, how strongly it is inked, where
 *  its baseline sits, measured down from the top of the element's box, and the box it fills: its top and its estimated
 *  width, centred across the element (what keeps the editor's Delete button clear of the words). */
export type RetiredPlaceholderLine = {
  role: 'name' | 'note' | 'label';
  text: string;
  size: number;
  weight: number;
  opacity: number;
  baseline: number;
  top: number;
  width: number;
};

/** The whole card, in the element's own box (0, 0 at its top-left): the outline's inset, corner radius, width and
 *  dash, and the lines, centred across the box. */
export type RetiredPlaceholderLayout = {
  inset: number;
  radius: number;
  strokeWidth: number;
  dash: readonly [number, number];
  lines: RetiredPlaceholderLine[];
};

const STROKE_WIDTH = 1.5;
const DASH: readonly [number, number] = [6, 4];
const RADIUS = 8;
// The room kept between the words and the outline, on every side.
const PADDING = 10;
// Each line's box is its size times this; the baseline sits ASCENT of the size down it.
const LINE_HEIGHT = 1.3;
const ASCENT = 0.95;
// The per-character advance the fit estimates with: a bold name runs wider than the regular note and label.
const BOLD_EM = 0.58;
const REGULAR_EM = 0.52;

const LINE_STYLES: Record<
  RetiredPlaceholderLine['role'],
  { size: number; weight: number; opacity: number }
> = {
  name: { size: 15, weight: 600, opacity: 1 },
  note: { size: 12, weight: 400, opacity: 0.7 },
  label: { size: 13, weight: 500, opacity: 0.85 },
};

type RetiredSource = {
  type?: unknown;
  shape?: unknown;
  session?: unknown;
  label?: unknown;
  width: number;
  height: number;
};

/**
 * Lay out a retired element's placeholder in its box. The name always shows; the note and then the label give way,
 * last first, when the box is too short to hold them, and every line is cut with an ellipsis to the box's width.
 */
export function retiredPlaceholderLayout(el: RetiredSource): RetiredPlaceholderLayout {
  const width = Number.isFinite(el.width) ? Math.max(0, el.width) : 0;
  const height = Number.isFinite(el.height) ? Math.max(0, el.height) : 0;
  const room = Math.max(0, width - PADDING * 2);
  const label = typeof el.label === 'string' ? el.label.trim() : '';
  const wanted: { role: RetiredPlaceholderLine['role']; text: string }[] = [
    { role: 'name', text: retiredElementName(el) },
    { role: 'note', text: RETIRED_ELEMENT_NOTE },
    ...(label ? [{ role: 'label' as const, text: label }] : []),
  ];
  const lineBox = (role: RetiredPlaceholderLine['role']) => LINE_STYLES[role].size * LINE_HEIGHT;
  const total = (rows: typeof wanted) => rows.reduce((sum, row) => sum + lineBox(row.role), 0);
  while (wanted.length > 1 && total(wanted) > height - PADDING * 2) wanted.pop();
  let cursor = (height - total(wanted)) / 2;
  const lines = wanted.map(({ role, text }) => {
    const style = LINE_STYLES[role];
    const em = style.weight >= 600 ? BOLD_EM : REGULAR_EM;
    const fitted = fitLine(text, room, style.size, em);
    const line: RetiredPlaceholderLine = {
      role,
      text: fitted,
      ...style,
      baseline: cursor + (lineBox(role) - style.size) / 2 + style.size * ASCENT,
      top: cursor,
      width: Math.min(room, fitted.length * style.size * em),
    };
    cursor += lineBox(role);
    return line;
  });
  return {
    inset: STROKE_WIDTH / 2,
    radius: Math.min(RADIUS, width / 2, height / 2),
    strokeWidth: STROKE_WIDTH,
    dash: DASH,
    lines,
  };
}
