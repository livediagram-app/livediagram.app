// Comparison and pricing tables (docs/specs/009-elements/comparison-tables.md): a cell holding only a tick or a cross
// draws as a coloured mark, and one column can be highlighted as the recommended one. Pure: which texts are marks,
// and the colours the canvas and every export paint marks and the highlight with, so the two cannot drift.

import { colorWash } from '@liveworkspace/model-core/color-wash';
import type { CanvasSurface } from './colour-math';
import { labelOn, reachContrast, THEME_LINE_CONTRAST } from './readable-colour';

export type TableMark = 'tick' | 'cross';

/** What the cell menu's Tick and Cross write: the text is the mark, so copies, CSV and agents read it. */
export const TABLE_MARK_TEXT: Record<TableMark, string> = { tick: '✓', cross: '✗' };

const TICK_TEXTS: ReadonlySet<string> = new Set(['✓', '✔', '✅', '☑']);
const CROSS_TEXTS: ReadonlySet<string> = new Set(['✗', '✘', '✕', '❌', '×', '☒']);
// A text or emoji presentation selector after the glyph changes nothing about what it says.
const VARIATION_SELECTOR = /[\uFE0E\uFE0F]$/u;

/** The mark a cell's text is, or null for a cell of words. Only the whole (trimmed) text counts. */
export function tableCellMark(text: string): TableMark | null {
  if (text.length > 8) return null;
  const t = text.trim().replace(VARIATION_SELECTOR, '');
  if (TICK_TEXTS.has(t)) return 'tick';
  if (CROSS_TEXTS.has(t)) return 'cross';
  return null;
}

const MARK_COLOURS: Record<TableMark, Record<CanvasSurface, string>> = {
  tick: { light: '#15803d', dark: '#4ade80' },
  cross: { light: '#be123c', dark: '#fb7185' },
};

/** A mark's stroke and its disc's wash on `ground` (the cell's background as drawn). The stroke meets 3:1 on it, the
 *  non-text floor; `own` (a cell's text colour) paints it instead when set. */
export function tableMarkColours(
  mark: TableMark,
  surface: CanvasSurface,
  ground: string,
  own?: string,
): { stroke: string; wash: string } {
  const stroke = own ?? reachContrast(MARK_COLOURS[mark][surface], ground, THEME_LINE_CONTRAST);
  return { stroke, wash: colorWash(stroke, 0.14) };
}

/** The highlighted column's colours, from the table's accent (its stroke): a wash for its body cells, the accent for
 *  its header cell with an ink that reads on it, and the accent for its frame. */
export function tableHighlightColours(accent: string): {
  wash: string;
  header: string;
  headerInk: string;
  frame: string;
} {
  return {
    wash: colorWash(accent, 0.1),
    header: accent,
    headerInk: labelOn(accent),
    frame: accent,
  };
}

/** The mark's disc diameter in a cell: the font's 1.5 times, never more than the cell's height inside its padding. */
export function tableMarkSize(fontPx: number, cellHeight: number, pad: number): number {
  return Math.max(8, Math.min(fontPx * 1.5, cellHeight - pad * 2));
}

/** The mark's glyph as a path in a 24 × 24 box centred on (12, 12). */
export function tableMarkPath(mark: TableMark): string {
  return mark === 'tick' ? 'M7.5 12.4l3 3 6-6.6' : 'M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8';
}
