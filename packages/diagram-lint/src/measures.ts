// The summary line's numbers (blueprint "Behaviour and state" step 2): crossing arrow pairs, shared with
// `edge-crossings`, and the drawing's extent.

import { contentBounds, pathsCross, type ElementId, type Rect } from '@livediagram/document';
import { LINT_MAX_ARROWS } from './constants';
import type { LintContext } from './context';

export type Crossings = {
  pairs: number;
  // How many others each arrow crosses.
  perArrow: ReadonlyMap<ElementId, number>;
};

const intersects = (a: Rect, b: Rect) =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

// Pairs of drawable arrows whose routes cross, each pair once; null above LINT_MAX_ARROWS (N2).
export function crossingPairs(ctx: LintContext): Crossings | null {
  const arrows = ctx.drawable;
  if (arrows.length > LINT_MAX_ARROWS) return null;
  const perArrow = new Map<ElementId, number>();
  let pairs = 0;
  for (let i = 0; i < arrows.length; i++) {
    for (let j = i + 1; j < arrows.length; j++) {
      const [p, q] = [arrows[i]!, arrows[j]!];
      if (!intersects(p.bounds, q.bounds) || !pathsCross(p.polyline, q.polyline)) continue;
      pairs++;
      for (const id of [p.arrow.id, q.arrow.id]) perArrow.set(id, (perArrow.get(id) ?? 0) + 1);
    }
  }
  return { pairs, perArrow };
}

// The drawing's rounded extent, arrow routes and label plates included; null when nothing is visible.
export function lintExtent(ctx: LintContext): { width: number; height: number } | null {
  const drawn = ctx.visible.filter(
    (el) =>
      (el.type === 'arrow' && !ctx.dangling.includes(el)) ||
      (el.type !== 'arrow' && [el.x, el.y, el.width, el.height].every((v) => Number.isFinite(v))),
  );
  if (drawn.length === 0) return null;
  const b = contentBounds(drawn, ctx.labels);
  return { width: Math.round(b.w), height: Math.round(b.h) };
}
