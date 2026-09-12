import { labelMeasure, wrapLabel } from '@livediagram/diagram';

// Auto-fit for MULTI-LINE labels (spec/139): the font size at which the
// wrapped text just fills its box. `scale` on a sticky used to mean a fixed
// 14px — which read as a lie next to the Scale tile, and left an
// unresizable event-storming note with no way out of overflow. Now it means
// what it says: a two-word event fills the note, a long policy sentence
// shrinks to fit, exactly like writing on real paper.
//
// PURE by design (a binary search over the shared wrap + measure helpers the
// SVG export already uses): the display label, the inline editor and any
// future renderer must land on the same number, or the text jumps the moment
// you double-click.

// The band a fitted label lives in. The ceiling keeps a two-word note from
// becoming a billboard; the floor stops an essay shrinking into illegibility
// (past it the box simply clips, as it always did).
export const FIT_MIN_PX = 10;
export const FIT_MAX_PX = 44;

// Line box as a multiple of the font size — matching the display label's own
// leading, so the fit measures the layout that actually renders.
const LINE_HEIGHT_RATIO = 1.5;

export function fitMultilineFontPx({
  text,
  width,
  height,
  padding,
  bold = false,
  italic = false,
}: {
  text: string;
  width: number;
  height: number;
  padding: number;
  bold?: boolean;
  italic?: boolean;
}): number {
  const availableW = Math.max(1, width - padding * 2);
  const availableH = Math.max(1, height - padding * 2);
  if (!text.trim()) return FIT_MAX_PX;

  const fits = (px: number): boolean => {
    const lines = wrapLabel(text, availableW, labelMeasure(px, bold, italic));
    // Height is the binding constraint once wrapping has done its job; a
    // single unbreakable word can still overflow the width, so check both.
    if (lines.length * px * LINE_HEIGHT_RATIO > availableH) return false;
    const measure = labelMeasure(px, bold, italic);
    return lines.every((line) => measure(line) <= availableW);
  };

  // Binary search on integers: ~6 iterations over the band, deterministic,
  // and cheap enough to run per render without memoisation games.
  let lo = FIT_MIN_PX;
  let hi = FIT_MAX_PX;
  if (fits(hi)) return hi;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(FIT_MIN_PX, lo);
}
