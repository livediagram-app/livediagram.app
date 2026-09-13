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

// The band a fitted label lives in.
//
// The ceiling is the pen: on a real wall everyone writes at roughly one size,
// so a two-word event and a two-line policy sit at the same weight and the
// board reads as one surface. Let a short label fill its paper and it becomes
// a poster that shouts down every note beside it — which is what 44px did.
// The floor stops an essay shrinking into illegibility (past it the box
// simply clips, as it always did).
export const FIT_MIN_PX = 10;
export const FIT_MAX_PX = 25;

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

  // How many words the label has. One word has no pair to make, so the
  // companionship rule below simply doesn't apply to it.
  const wordCount = text.trim().split(/\s+/).length;

  const linesAt = (px: number) => wrapLabel(text, availableW, labelMeasure(px, bold, italic));

  const fits = (px: number): boolean => {
    const lines = linesAt(px);
    // Height is the binding constraint once wrapping has done its job; a
    // single unbreakable word can still overflow the width, so check both.
    if (lines.length * px * LINE_HEIGHT_RATIO > availableH) return false;
    const measure = labelMeasure(px, bold, italic);
    return lines.every((line) => measure(line) <= availableW);
  };

  // "Fits" isn't enough on a sticky. At a big enough size every word lands on
  // its own line, and the note stops reading as a phrase and starts reading
  // as a column of fragments — technically fitted, visually wrong. So a
  // multi-word label must also keep at least one PAIR of words together.
  const pairsUp = (px: number): boolean => wordCount < 2 || linesAt(px).length < wordCount;

  const fitsAndPairs = (px: number): boolean => fits(px) && pairsUp(px);

  // Binary search on integers: ~6 iterations over the band, deterministic,
  // and cheap enough to run per render without memoisation games.
  //
  // Two searches, not one: the pair rule is not monotonic the way "fits" is
  // (a size can fit while stacking words, and shrinking fixes it), so we
  // search for the largest size satisfying BOTH, and fall back to the plain
  // fit when no size can pair the words up — two long words that can never
  // share a line must not drag the whole note down to 10px.
  const search = (predicate: (px: number) => boolean): number | null => {
    if (predicate(FIT_MAX_PX)) return FIT_MAX_PX;
    let lo = FIT_MIN_PX;
    let hi = FIT_MAX_PX;
    if (!predicate(lo)) return null;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (predicate(mid)) lo = mid;
      else hi = mid - 1;
    }
    return Math.max(FIT_MIN_PX, lo);
  };

  return search(fitsAndPairs) ?? search(fits) ?? FIT_MIN_PX;
}
