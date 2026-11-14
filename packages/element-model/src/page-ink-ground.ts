// What an element on a page sits on, as re-inking measures it (docs/specs/007-editor/
// pages-mode.md "Re-inking"): the page's tones under the element's box. A solid is one
// tone; the paper is white; a picture is its tone under its overlay; a gradient is the colours it
// runs through across the box, along its angle, as CSS draws `linear-gradient(<angle>deg, ...)`.
// Pure. One copy for every product with pages; each binds pageGroundFor to its own fill tone (a picture's tone
// is read from its own page model) at its page-ink-ground.ts.
import { mixHex } from './page-ink-contrast';
import type { Rect } from '@liveworkspace/model-core/geometry-primitives';

// The plain paper, measured as printed and exported.
export const PAPER_TONE = '#ffffff';
// How many points a gradient is sampled at across an element's span (its two ends and evenly
// between): a two-stop gradient's colours lie on one line, so its worst contrast is near an end,
// and five points find it to within a quarter of the span.
const GRADIENT_SAMPLES = 5;

export type PageGround = {
  // Every tone the element may sit on: text and lines must read on the worst of them.
  tones: string[];
  // Their mean: what an area (a card) is seen against as a whole.
  mean: string;
};

/** Where a point falls along a CSS linear gradient drawn over `rect` at `angle` degrees: 0 at the
 *  start line, 1 at the end line (clamped). */
export function gradientPosition(
  rect: Rect,
  angle: number,
  point: { x: number; y: number },
): number {
  const rad = (angle * Math.PI) / 180;
  // CSS: 0deg points up, 90deg right; screen y grows downward.
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const length = Math.abs(rect.width * dx) + Math.abs(rect.height * dy);
  if (length === 0) return 0.5;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const t = ((point.x - cx) * dx + (point.y - cy) * dy) / length + 0.5;
  return Math.min(1, Math.max(0, t));
}

// A page fill as the ground reads it: a gradient's angle and two ends; any other kind is one tone.
type GroundFill = { kind: string };
type GradientGround = { kind: 'gradient'; angle: number; from: string; to: string };

/** pageGroundUnder bound to a product's `pageFillTone` (a solid's colour, a picture's tone). */
export function pageGroundFor<F extends GroundFill>(
  pageFillTone: (fill: F) => string,
): (background: { fill?: F } | undefined, rect: Rect, box: Rect) => PageGround {
  return (background, rect, box) => pageGroundUnder(background, rect, box, pageFillTone);
}

/** The page's tones under a box, for a page whose background is `background` and whose rectangle
 *  is `rect`. */
function pageGroundUnder<F extends GroundFill>(
  background: { fill?: F } | undefined,
  rect: Rect,
  box: Rect,
  pageFillTone: (fill: F) => string,
): PageGround {
  const own = background?.fill;
  if (!own) return { tones: [PAPER_TONE], mean: PAPER_TONE };
  if (own.kind !== 'gradient') {
    const tone = pageFillTone(own);
    return { tones: [tone], mean: tone };
  }
  const fill = own as unknown as GradientGround;
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x, y: box.y + box.height },
    { x: box.x + box.width, y: box.y + box.height },
  ].map((p) => gradientPosition(rect, fill.angle, p));
  const lo = Math.min(...corners);
  const hi = Math.max(...corners);
  const tones: string[] = [];
  for (let i = 0; i < GRADIENT_SAMPLES; i += 1) {
    const t = lo + ((hi - lo) * i) / (GRADIENT_SAMPLES - 1);
    tones.push(mixHex(fill.from, fill.to, t));
  }
  return { tones: [...new Set(tones)], mean: mixHex(fill.from, fill.to, (lo + hi) / 2) };
}
