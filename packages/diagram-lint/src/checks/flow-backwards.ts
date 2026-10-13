// `flow-backwards` (info): a directed connecting arrow points against the flow by more than
// LINT_FLOW_TOLERANCE_PX (LN15); undirected arrows and self-loops are skipped (N8), and so is an arrow that closes a
// loop (its target leads back to its source along the arrows): a retry or a cycle runs back by design, and the fix
// would reverse what it means.

import { arrowName } from '../arrow-names';
import { LINT_FLOW_TOLERANCE_PX } from '../constants';
import { refOf } from '../context';
import { fixes } from '../fixes';
import { directedVector, directionOf, headOf, inferFlow, type LintFlow } from '../flow';
import type { Check } from './types';

// How far a vector runs against a flow.
function against(flow: LintFlow, { dx, dy }: { dx: number; dy: number }): number {
  switch (flow) {
    case 'down':
      return -dy;
    case 'up':
      return dy;
    case 'right':
      return -dx;
    case 'left':
      return dx;
  }
}

export const flowBackwards: Check = (ctx) => {
  const flow = inferFlow(ctx);
  if (!flow) return [];
  // Each directed arrow as drawn, tail to tip (an arrow headed at its from end runs the other way round).
  const drawn = (d: (typeof ctx.connecting)[number]) => {
    const head = headOf(d.arrow);
    return !head ? null : head === 'to' ? [d.from!.id, d.to!.id] : [d.to!.id, d.from!.id];
  };
  const out = new Map<string, string[]>();
  for (const d of ctx.connecting) {
    const ends = drawn(d);
    if (ends) (out.get(ends[0]!) ?? out.set(ends[0]!, []).get(ends[0]!)!).push(ends[1]!);
  }
  // Whether `from` leads to `to` along the arrows.
  const leads = (from: string, to: string) => {
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length) {
      const at = queue.shift()!;
      for (const next of out.get(at) ?? []) {
        if (next === to) return true;
        if (!seen.has(next)) seen.add(next) && queue.push(next);
      }
    }
    return false;
  };
  return ctx.connecting.flatMap((d) => {
    const v = directedVector(d);
    if (!v || against(flow, v) <= LINT_FLOW_TOLERANCE_PX) return [];
    const [tail, tip] = drawn(d)!;
    if (leads(tip!, tail!)) return [];
    const ref = refOf(ctx, d.arrow.id);
    return [
      {
        code: 'flow-backwards' as const,
        refs: [ref],
        message: `${arrowName(ctx, d.arrow)} points ${directionOf(v)}, against the flow ${flow}`,
        fix: fixes.flowBackwards(ctx.source, ref, refOf(ctx, d.from!.id), refOf(ctx, d.to!.id)),
        at: d.polyline[0]!,
      },
    ];
  });
};
