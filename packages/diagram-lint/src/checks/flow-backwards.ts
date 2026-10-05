// `flow-backwards` (info): a directed connecting arrow points against the flow by more than
// LINT_FLOW_TOLERANCE_PX (LN15); undirected arrows and self-loops are skipped (N8).

import { arrowName } from '../arrow-names';
import { LINT_FLOW_TOLERANCE_PX } from '../constants';
import { refOf } from '../context';
import { fixes } from '../fixes';
import { directedVector, directionOf, inferFlow, type LintFlow } from '../flow';
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
  return ctx.connecting.flatMap((d) => {
    const v = directedVector(d);
    if (!v || against(flow, v) <= LINT_FLOW_TOLERANCE_PX) return [];
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
