// `arrow-behind-box` (warning): an arrow passes through a box it does not connect, one finding an arrow
// listing every such box (LN8).

import { arrowStyleOf, pathPassesThrough, queryElementGrid } from '@livediagram/document';
import { arrowName, arrowSelector } from '../arrow-names';
import { isLintBox } from '../boxes';
import { padded, refOf } from '../context';
import { fixes } from '../fixes';
import type { Check } from './types';

export const arrowBehindBox: Check = (ctx) =>
  ctx.drawable.flatMap((d) => {
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
