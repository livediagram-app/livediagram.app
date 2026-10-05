// `box-overlap` (error): two boxes that arrows connect partly overlap; one wholly inside the other does not
// count (N12). Boxes no arrow connects are decoration and may overlap by design.
// Candidates come from the element grid, so each pair is tested once, the earlier box first.

import { queryElementGrid } from '@livediagram/document';
import { boxBounds, holdsWholly, isLintBox, overlapDepth } from '../boxes';
import { LINT_OVERLAP_TOLERANCE_PX } from '../constants';
import { padded, refOf } from '../context';
import { fixes } from '../fixes';
import type { Check } from './types';

export const boxOverlap: Check = (ctx) =>
  ctx.boxes
    .filter((a) => ctx.connected.has(a.id))
    .flatMap((a) => {
      const order = ctx.order.get(a.id)!;
      return queryElementGrid(ctx.grid, padded(ctx, boxBounds(a)))
        .filter(isLintBox)
        .filter((b) => ctx.connected.has(b.id) && ctx.order.get(b.id)! > order)
        .filter((b) => overlapDepth(a, b) > LINT_OVERLAP_TOLERANCE_PX && !holdsWholly(a, b))
        .map((b) => {
          const [ra, rb] = [refOf(ctx, a.id), refOf(ctx, b.id)];
          return {
            code: 'box-overlap' as const,
            refs: [ra, rb],
            message: `${ra} overlaps ${rb}`,
            fix: fixes.boxOverlap(ctx.source, ra, rb),
            at: { x: a.x, y: a.y },
          };
        });
    });
