// The direction a tab flows (blueprint "The checks", LN15): the larger-axis class of most connecting
// directed arrows, or none.

import type { ArrowElement } from '@livediagram/document';
import { centreOf } from './boxes';
import { LINT_FLOW_MIN_ARROWS, LINT_FLOW_MIN_SHARE } from './constants';
import type { DrawableArrow, LintContext } from './context';

export type LintFlow = 'down' | 'up' | 'right' | 'left';

// Whether an arrow points from its `from` end (`to`), the other way (`from`), or neither.
export function headOf(arrow: ArrowElement): 'to' | 'from' | null {
  const ends = arrow.arrowEnds ?? 'to';
  return ends === 'to' || ends === 'from' ? ends : null;
}

// Tail to head between box centres, for a directed connecting arrow.
export function directedVector(d: DrawableArrow): { dx: number; dy: number } | null {
  const head = headOf(d.arrow);
  if (!head || !d.from || !d.to) return null;
  const [tail, tip] = head === 'to' ? [d.from, d.to] : [d.to, d.from];
  const a = centreOf(tail);
  const b = centreOf(tip);
  return { dx: b.x - a.x, dy: b.y - a.y };
}

export function directionOf({ dx, dy }: { dx: number; dy: number }): LintFlow {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}

export function inferFlow(ctx: LintContext): LintFlow | null {
  if (ctx.flow) return ctx.flow;
  const vectors = ctx.connecting.flatMap((d) => {
    const v = directedVector(d);
    return v ? [v] : [];
  });
  if (vectors.length < LINT_FLOW_MIN_ARROWS) return null;
  const counts = new Map<LintFlow, number>();
  for (const v of vectors) counts.set(directionOf(v), (counts.get(directionOf(v)) ?? 0) + 1);
  const [flow, count] = [...counts].sort((a, b) => b[1] - a[1])[0]!;
  return count >= LINT_FLOW_MIN_SHARE * vectors.length ? flow : null;
}
