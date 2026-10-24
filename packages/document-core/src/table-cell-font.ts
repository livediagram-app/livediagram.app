// A table's cell font size (docs/specs/008-canvas/canvas-and-palette.md Table), in ONE place for
// the canvas (TableView / TableCellView) and the headless SVG emitter (svg-render-table.ts), which
// each kept their own copy of the table.
import type { TextSize, TextSizePreset } from './basics';
import { readTextSize } from './label-font';

/**
 * Cell font px per preset (element-space px; the canvas zoom scales it like everything else).
 * 'scale' is listed for completeness but never read: it tracks the row height instead.
 */
export const CELL_FONT_PX: Record<TextSizePreset, number> = { sm: 11, md: 13, lg: 16, scale: 13 };

/**
 * 'scale' cell text tracks the row height (~40%), clamped to a legible range, so it grows and
 * shrinks as the table is resized.
 */
export function scaleCellFontPx(rowH: number): number {
  return Math.max(9, Math.min(40, Math.round(rowH * 0.4)));
}

/**
 * The px a cell's text draws at: 'scale' fits the row, an exact size from the Size slider is its
 * own px, and a preset reads the table. Absent `size` means `fallback` (the table-wide size for a
 * cell, Medium for the table itself).
 */
export function tableCellFontPx(
  size: TextSize | undefined,
  rowH: number,
  fallback = CELL_FONT_PX.md,
): number {
  if (size === undefined) return fallback;
  const read = readTextSize(size);
  if (read === 'scale') return scaleCellFontPx(rowH);
  if (typeof read === 'number') return read;
  return CELL_FONT_PX[read];
}
