// `label-collision` (warning): an arrow's label plate overlaps a box, the arrow's own ends included (LN8).

import { queryElementGrid, type Rect } from '@livediagram/document';
import { arrowName, arrowSelector } from '../arrow-names';
import { boxBounds, isLintBox } from '../boxes';
import { LINT_OVERLAP_TOLERANCE_PX } from '../constants';
import { padded, refOf } from '../context';
import { fixes } from '../fixes';
import type { Check } from './types';

// Overlap deeper than the tolerance on both axes.
const overlaps = (a: Rect, b: Rect) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > LINT_OVERLAP_TOLERANCE_PX &&
  Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > LINT_OVERLAP_TOLERANCE_PX;

export const labelCollision: Check = (ctx) =>
  ctx.drawable.flatMap((d) => {
    const layout = ctx.labels.layouts.get(d.arrow.id);
    if (!layout) return [];
    const plate = {
      x: layout.center.x - layout.width / 2,
      y: layout.center.y - layout.height / 2,
      width: layout.width,
      height: layout.height,
    };
    const hit = queryElementGrid(ctx.grid, padded(ctx, plate))
      .filter(isLintBox)
      .filter((box) => overlaps(plate, boxBounds(box)));
    if (hit.length === 0) return [];
    const boxes = hit.map((box) => refOf(ctx, box.id));
    return [
      {
        code: 'label-collision' as const,
        refs: [refOf(ctx, d.arrow.id), ...boxes],
        message: `${arrowName(ctx, d.arrow)} label overlaps ${boxes.join(', ')}`,
        fix: fixes.labelCollision(ctx.source, arrowSelector(ctx, d.arrow)),
        at: d.polyline[0]!,
      },
    ];
  });
