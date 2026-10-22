// `arrow-behind-box` (warning): an arrow passes through a box it does not connect, one finding an arrow
// listing every such box (LN8). An arrow that opts out of route-behind is drawn over them by choice: not behind.

import { boundsOfPoints, pathPassesThrough, queryElementGrid } from '@livepages/document';
import { arrowName, arrowSelector } from '../arrow-names';
import { isLintBox } from '../boxes';
import { LINT_MOVE_CLEAR } from '../constants';
import { padded, refOf } from '../context';
import { fixes } from '../fixes';
import { restyledRoutes } from '../restyle';
import type { Check } from './types';

export const arrowBehindBox: Check = (ctx) =>
  ctx.drawable.flatMap((d) => {
    // Drawn over the boxes it crosses on purpose (routeBehind false), it passes behind none.
    if (d.arrow.routeBehind === false) return [];
    const behind = queryElementGrid(ctx.grid, padded(ctx, d.bounds))
      .filter(isLintBox)
      .filter((box) => box.id !== d.from?.id && box.id !== d.to?.id)
      .filter((box) => pathPassesThrough(d.polyline, box));
    if (behind.length === 0) return [];
    const boxes = behind.map((box) => refOf(ctx, box.id));
    // The first other style whose route passes behind no box but its ends, each route tested against the boxes near
    // it (the grid), so the cost follows the findings, not the tab.
    const clears = restyledRoutes(ctx, d.arrow).find(
      ({ route }) =>
        !queryElementGrid(ctx.grid, padded(ctx, boundsOfPoints(route)!))
          .filter(isLintBox)
          .some(
            (box) => box.id !== d.from?.id && box.id !== d.to?.id && pathPassesThrough(route, box),
          ),
    );
    return [
      {
        code: 'arrow-behind-box' as const,
        refs: [refOf(ctx, d.arrow.id), ...boxes],
        message: `${arrowName(ctx, d.arrow)} passes behind ${boxes.join(', ')}`,
        fix: fixes.arrowBehindBox(arrowSelector(ctx, d.arrow), clears?.style ?? null, {
          box: boxes[0]!,
          by: clearShift(d.polyline, behind[0]!),
        }),
        at: d.polyline[0]!,
      },
    ];
  });

// How far to move a box so a line through it clears it by LINT_MOVE_CLEAR: across the first run that passes through
// it, the shorter way.
function clearShift(
  route: readonly { x: number; y: number }[],
  box: { x: number; y: number; width: number; height: number },
): { dx: number; dy: number } {
  const run = route
    .slice(1)
    .map((p, i) => [route[i]!, p] as const)
    .find(([a, b]) => pathPassesThrough([a, b], box as never));
  // The finding exists because the route passes behind the box, so one of its runs does.
  const [a, b] = run!;
  const level = Math.abs(a.y - b.y) <= Math.abs(a.x - b.x);
  const at = level ? (a.y + b.y) / 2 : (a.x + b.x) / 2;
  const [lo, size] = level ? [box.y, box.height] : [box.x, box.width];
  const after = Math.round(at + LINT_MOVE_CLEAR - lo);
  const before = Math.round(at - LINT_MOVE_CLEAR - (lo + size));
  const shift = Math.abs(after) <= Math.abs(before) ? after : before;
  return level ? { dx: 0, dy: shift } : { dx: shift, dy: 0 };
}
