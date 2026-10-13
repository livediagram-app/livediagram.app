// `arrow-behind-box` (warning): an arrow passes through a box it does not connect, one finding an arrow
// listing every such box (LN8). An arrow that opts out of route-behind is drawn over them by choice: not behind.

import { arrowStyleOf, pathPassesThrough, queryElementGrid } from '@livediagram/document';
import { arrowName, arrowSelector } from '../arrow-names';
import { isLintBox } from '../boxes';
import { padded, refOf } from '../context';
import { fixes } from '../fixes';
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
    return [
      {
        code: 'arrow-behind-box' as const,
        refs: [refOf(ctx, d.arrow.id), ...boxes],
        message: `${arrowName(ctx, d.arrow)} passes behind ${boxes.join(', ')}`,
        fix: fixes.arrowBehindBox(
          ctx.source,
          arrowSelector(ctx, d.arrow),
          arrowStyleOf(d.arrow) === 'angled',
        ),
        at: d.polyline[0]!,
      },
    ];
  });
