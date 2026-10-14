// `label-collision` (warning): an arrow's label plate overlaps a box, the arrow's own ends included (LN8).

import { queryElementGrid, type Rect } from '@livediagram/document';
import { arrowName, arrowSelector } from '../arrow-names';
import { boxBounds, isLintBox } from '../boxes';
import { LINT_LABEL_RUN_PAD, LINT_OVERLAP_TOLERANCE_PX } from '../constants';
import { padded, refOf } from '../context';
import { fixes } from '../fixes';
import type { Check } from './types';

// Overlap deeper than the tolerance on both axes.
const overlaps = (a: Rect, b: Rect) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > LINT_OVERLAP_TOLERANCE_PX &&
  Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > LINT_OVERLAP_TOLERANCE_PX;

// How many characters the edge's longest run holds: its length less the room a label keeps either end, over the
// plate's width per character.
function fits(
  polyline: readonly { x: number; y: number }[],
  plateWidth: number,
  label?: string,
): number {
  const longest = Math.max(
    0,
    ...polyline.slice(1).map((p, i) => Math.hypot(p.x - polyline[i]!.x, p.y - polyline[i]!.y)),
  );
  const perChar = plateWidth / Math.max(1, (label ?? '').trim().length);
  return Math.max(3, Math.floor((longest - 2 * LINT_LABEL_RUN_PAD) / Math.max(1, perChar)));
}

const plateOf = (layout: { center: { x: number; y: number }; width: number; height: number }) => ({
  x: layout.center.x - layout.width / 2,
  y: layout.center.y - layout.height / 2,
  width: layout.width,
  height: layout.height,
});

export const labelCollision: Check = (ctx) =>
  ctx.drawable.flatMap((d, i) => {
    const layout = ctx.labels.layouts.get(d.arrow.id);
    if (!layout) return [];
    const plate = plateOf(layout);
    const hit = queryElementGrid(ctx.grid, padded(ctx, plate))
      .filter(isLintBox)
      .filter((box) => overlaps(plate, boxBounds(box)));
    // Another arrow's label over this one (two exits' "Yes" and "No" stacked on one point): each pair once.
    const labels = ctx.drawable.slice(i + 1).filter((o) => {
      const other = ctx.labels.layouts.get(o.arrow.id);
      return !!other && overlaps(plate, plateOf(other));
    });
    if (hit.length === 0 && labels.length === 0) return [];
    const boxes = [
      ...hit.map((box) => refOf(ctx, box.id)),
      ...labels.map((o) => `${arrowName(ctx, o.arrow)}'s label`),
    ];
    return [
      {
        code: 'label-collision' as const,
        refs: [
          refOf(ctx, d.arrow.id),
          ...hit.map((box) => refOf(ctx, box.id)),
          ...labels.map((o) => refOf(ctx, o.arrow.id)),
        ],
        message: `${arrowName(ctx, d.arrow)} label overlaps ${boxes.join(', ')}`,
        fix: fixes.labelCollision(
          ctx.source,
          arrowSelector(ctx, d.arrow),
          fits(d.polyline, layout.width, d.arrow.label),
        ),
        at: d.polyline[0]!,
      },
    ];
  });
