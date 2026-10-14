// `label-collision` (warning): an arrow's label plate overlaps a box, the arrow's own ends included (LN8), another
// arrow's label, or another arrow's line crossing it (a label struck through, which a reader cannot read).

import {
  pathPassesThrough,
  queryElementGrid,
  type BoxedElement,
  type Point,
  type Rect,
} from '@livediagram/document';
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
  label: string,
): number {
  const longest = Math.max(
    0,
    ...polyline.slice(1).map((p, i) => Math.hypot(p.x - polyline[i]!.x, p.y - polyline[i]!.y)),
  );
  const perChar = plateWidth / Math.max(1, label.trim().length);
  return Math.max(3, Math.floor((longest - 2 * LINT_LABEL_RUN_PAD) / Math.max(1, perChar)));
}

// The plate as a box to test a path against, drawn in by the tolerance: a line grazing its edge does not strike it.
const asBox = (r: Rect): BoxedElement =>
  ({
    id: '',
    type: 'shape',
    shape: 'square',
    x: r.x + LINT_OVERLAP_TOLERANCE_PX,
    y: r.y + LINT_OVERLAP_TOLERANCE_PX,
    width: Math.max(1, r.width - 2 * LINT_OVERLAP_TOLERANCE_PX),
    height: Math.max(1, r.height - 2 * LINT_OVERLAP_TOLERANCE_PX),
  }) as BoxedElement;

// The axis of the run of `pts` that a point lies on: level, upright, or neither.
function axisAt(pts: readonly Point[], c: Point): 'level' | 'upright' | null {
  for (let k = 1; k < pts.length; k++) {
    const [a, b] = [pts[k - 1]!, pts[k]!];
    if (Math.abs(a.y - b.y) < 1 && Math.abs(c.y - a.y) < 1) {
      if (c.x >= Math.min(a.x, b.x) - 1 && c.x <= Math.max(a.x, b.x) + 1) return 'level';
    } else if (Math.abs(a.x - b.x) < 1 && Math.abs(c.x - a.x) < 1) {
      if (c.y >= Math.min(a.y, b.y) - 1 && c.y <= Math.max(a.y, b.y) + 1) return 'upright';
    }
  }
  return null;
}

// A run along the label's own track (its run's axis), through its centre: a bus the label cuts as its own line,
// never a strike. A line across the label, even through its very centre, is one.
const onTrack = (a: Point, b: Point, c: Point, axis: 'level' | 'upright' | null) =>
  axis === 'level'
    ? Math.abs(a.y - b.y) < 1 && Math.abs(a.y - c.y) < 1
    : axis === 'upright'
      ? Math.abs(a.x - b.x) < 1 && Math.abs(a.x - c.x) < 1
      : false;

// The point a fraction of the way along a polyline (two points or more), by length.
function pointAt(pts: readonly Point[], t: number): Point {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y));
  let left = t * lens.reduce((s, l) => s + l, 0);
  let i = 0;
  while (i < lens.length - 1 && left > lens[i]!) left -= lens[i++]!;
  const f = Math.min(1, left / Math.max(lens[i]!, 1e-9));
  return {
    x: pts[i]!.x + (pts[i + 1]!.x - pts[i]!.x) * f,
    y: pts[i]!.y + (pts[i + 1]!.y - pts[i]!.y) * f,
  };
}

// Where along its own line a struck label sits clear: the first of these fractions whose plate meets no box and no
// other line.
const CLEAR_SPOTS = [0.25, 0.75, 0.33, 0.67, 0.5, 0.15, 0.85] as const;

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
    // Another arrow's line crossing the plate, its runs along the label's own track aside.
    const strikesOf = (r: Rect, centre: Point) => {
      const axis = axisAt(d.polyline, centre);
      return ctx.drawable.filter(
        (o) =>
          o.arrow.id !== d.arrow.id &&
          o.polyline.some(
            (p, k) =>
              k > 0 &&
              !onTrack(o.polyline[k - 1]!, p, centre, axis) &&
              pathPassesThrough([o.polyline[k - 1]!, p], asBox(r)),
          ),
      );
    };
    const struck = strikesOf(plate, layout.center);
    if (hit.length === 0 && labels.length === 0 && struck.length === 0) return [];
    // No box in the way: another label or a line. The label moves along its own line to a spot clear of boxes, lines
    // and every other label; shortening a 7-character label to "at most 51" fixed nothing.
    if (hit.length === 0) {
      const others = ctx.drawable
        .filter((o) => o.arrow.id !== d.arrow.id)
        .flatMap((o) => {
          const l = ctx.labels.layouts.get(o.arrow.id);
          return l ? [plateOf(l)] : [];
        });
      const clear = CLEAR_SPOTS.find((t) => {
        const c = pointAt(d.polyline, t);
        const r = { ...plate, x: c.x - plate.width / 2, y: c.y - plate.height / 2 };
        return (
          strikesOf(r, c).length === 0 &&
          !others.some((o) => overlaps(r, o)) &&
          !queryElementGrid(ctx.grid, padded(ctx, r))
            .filter(isLintBox)
            .some((box) => overlaps(r, boxBounds(box)))
        );
      });
      const said = [
        ...(labels.length > 0
          ? [`overlaps ${labels.map((o) => `${arrowName(ctx, o.arrow)}'s label`).join(', ')}`]
          : []),
        ...(struck.length > 0
          ? [`struck by ${struck.map((o) => arrowName(ctx, o.arrow)).join(', ')}`]
          : []),
      ];
      return [
        {
          code: 'label-collision' as const,
          refs: [
            refOf(ctx, d.arrow.id),
            ...labels.map((o) => refOf(ctx, o.arrow.id)),
            ...struck.map((o) => refOf(ctx, o.arrow.id)),
          ],
          message: `${arrowName(ctx, d.arrow)} label ${said.join(' and ')}`,
          fix:
            clear !== undefined
              ? fixes.labelStruck(ctx.source, arrowSelector(ctx, d.arrow), clear)
              : fixes.labelCollision(
                  ctx.source,
                  arrowSelector(ctx, d.arrow),
                  fits(d.polyline, layout.width, d.arrow.label!),
                ),
          at: d.polyline[0]!,
        },
      ];
    }
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
          fits(d.polyline, layout.width, d.arrow.label!),
        ),
        at: d.polyline[0]!,
      },
    ];
  });
