// A chart meant to come from a liveplanner sheet and not linked yet (each product's docs/specs/009-elements/
// pie-chart.md "Not linked yet", Work Tracker 1281): how faded its sample marks draw, and the chip's words and size,
// one copy for the export (svg-render-charts.ts) and every canvas (workbench SheetPendingChart). Pure and small, so a
// canvas pays for nothing more.
import { textAdvanceEm } from '@liveworkspace/model-core/text-advance';

export const SHEET_PENDING_FADE = 0.3;
export const SHEET_PENDING_WORDS = 'Not linked to a sheet yet';
export const SHEET_PENDING_SHORT = 'Not linked yet';
export const SHEET_PENDING_CHIP = {
  fontPx: 11,
  height: 22,
  glyph: 10,
  // The glyph's lead-in, then the gap after it, then the end padding.
  lead: 9,
  gap: 6,
  end: 10,
} as const;

const { fontPx, height, glyph, lead, gap, end } = SHEET_PENDING_CHIP;

/** The chip's width for `words`. */
export const sheetPendingChipWidth = (words: string): number =>
  textAdvanceEm(words) * fontPx + lead + glyph + gap + end;

/** The chip's words on a chart this size: the longer ones where they fit, the short ones where only they do, none on a
 *  chart too small for either (the fade alone says it then). */
export function sheetPendingWords(width: number, chartHeight: number): string | null {
  if (chartHeight < height + 4) return null;
  return (
    [SHEET_PENDING_WORDS, SHEET_PENDING_SHORT].find(
      (w) => sheetPendingChipWidth(w) <= width - 8,
    ) ?? null
  );
}
