// What an element on a page sits on, as re-inking measures it (docs/specs/007-editor/
// pages-mode.md "Re-inking"): the page's tones under the element's box. A solid is one
// tone; the paper is white; a picture is its tone under its overlay; a gradient is the colours it
// runs through across the box, along its angle, as CSS draws `linear-gradient(<angle>deg, ...)`.
// Pure.
import { mixHex } from './page-ink-contrast';
import type { Page, PageRect } from './page';
import { pageFillTone } from './page-content';
import type { Rect } from '@liveworkspace/document-core/geometry-primitives';

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
  rect: PageRect,
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

/** The page's tones under a box, for a page whose background is `background` and whose rectangle
 *  is `rect`. */
export function pageGroundUnder(
  background: Page['background'],
  rect: PageRect,
  box: Rect,
): PageGround {
  const fill = background?.fill;
  if (!fill) return { tones: [PAPER_TONE], mean: PAPER_TONE };
  if (fill.kind !== 'gradient') {
    const tone = pageFillTone(fill);
    return { tones: [tone], mean: tone };
  }
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
