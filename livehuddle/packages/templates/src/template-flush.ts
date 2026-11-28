// Wall pieces flush in 3D (docs/specs/007-editor/templates-by-mode.md "Made for 3D"): a counter, a fridge, lockers or a
// machine a template stood against a wall is moved back until its model's back (its footprint, template-model-box.ts)
// stands on the wall's face, with whatever stands on its worktop. The flat drawing's box stood its top on the wall,
// which in 3D left the model a footprint's offset out in the room. Pure: no React, no DOM.

import {
  isFloorShape,
  mountsOnWall,
  pieceFacing,
  wallsOf,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import { modelFloorBox, STANDS_AGAINST_A_WALL } from './template-model-box';

type Box = { x: number; y: number; width: number; height: number };

/** Half a 3D wall: its face stands this far from its line (scene-walls.ts WALL_THICKNESS.wall / 2). */
const WALL_FACE = 4;
/** The gap left between a model's back and its wall's face, in canvas px. */
const FLUSH_GAP = 1;
/** How far behind a model's back its wall may be, in canvas px: a piece further out was stood in the floor. */
const FLUSH_REACH = 200;
// What stands on a worktop and goes with it.
const RIDERS = new Set(['microwave', 'kettle', 'coffee-machine']);
const WORKTOPS = new Set(['kitchen-counter', 'kitchen-sink', 'bar']);

const meets = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const isShape = (el: Element): el is ShapeElement => el.type === 'shape';

/** How far a piece's model is out from the wall behind it (its back to the wall's face), or null with none near. */
export function gapToWall(el: ShapeElement, walls: ReturnType<typeof wallsOf>): number | null {
  const m = modelFloorBox(el);
  const facing = pieceFacing(el);
  const vertical = facing === 'e' || facing === 'w';
  const into = facing === 'n' || facing === 'w' ? 1 : -1;
  const back =
    facing === 'n' ? m.y : facing === 's' ? m.y + m.height : facing === 'w' ? m.x : m.x + m.width;
  const mid = vertical ? m.y + m.height / 2 : m.x + m.width / 2;
  let best: number | null = null;
  for (const { a, b } of walls) {
    if (vertical ? Math.abs(a.x - b.x) > 0.5 : Math.abs(a.y - b.y) > 0.5) continue;
    const line = vertical ? a.x : a.y;
    const lo = vertical ? Math.min(a.y, b.y) : Math.min(a.x, b.x);
    const hi = vertical ? Math.max(a.y, b.y) : Math.max(a.x, b.x);
    if (mid < lo || mid > hi) continue;
    const gap = (back - line) * into - WALL_FACE;
    if (gap < -WALL_FACE || gap > FLUSH_REACH) continue;
    if (best === null || gap < best) best = gap;
  }
  return best;
}

// What a move back to the wall may pass over: floors, the wall's own pieces, and what hangs on a wall.
const PASSES = new Set(['door', 'window', 'room-sign', 'sticker', 'stairs']);
const passes = (el: ShapeElement) =>
  isFloorShape(el.shape) || PASSES.has(el.shape) || mountsOnWall(el.shape);

/**
 * Every standing wall piece moved straight back onto the face of the wall behind it, whatever stands on its worktop
 * with it, unless another piece stands in the way. Same array when none moved.
 */
export function flushToWalls(elements: Element[]): Element[] {
  const walls = wallsOf(elements);
  if (walls.length === 0) return elements;
  const out = elements.slice();
  let changed = false;
  out.forEach((el, i) => {
    if (!isShape(el) || !STANDS_AGAINST_A_WALL.has(el.shape)) return;
    const model = modelFloorBox(el);
    // A machine on a worktop goes where the worktop does.
    if (
      RIDERS.has(el.shape) &&
      out.some((o) => isShape(o) && WORKTOPS.has(o.shape) && meets(el, o))
    )
      return;
    const gap = gapToWall(el, walls);
    if (gap === null || Math.abs(gap - FLUSH_GAP) < 0.5) return;
    const move = gap - FLUSH_GAP;
    const f = pieceFacing(el);
    const dx = f === 'w' ? -move : f === 'e' ? move : 0;
    const dy = f === 'n' ? -move : f === 's' ? move : 0;
    const riders = WORKTOPS.has(el.shape)
      ? out.flatMap((o, j) => (isShape(o) && RIDERS.has(o.shape) && meets(o, el) ? [j] : []))
      : [];
    // The floor it crosses on its way back, clear of every other piece's model.
    const swept = {
      x: Math.min(model.x, model.x + dx),
      y: Math.min(model.y, model.y + dy),
      width: model.width + Math.abs(dx),
      height: model.height + Math.abs(dy),
    };
    const mine = new Set([i, ...riders]);
    const blocked = out.some(
      (o, j) => !mine.has(j) && isShape(o) && !passes(o) && meets(swept, modelFloorBox(o)),
    );
    if (blocked) return;
    for (const j of mine) {
      const o = out[j] as ShapeElement;
      out[j] = { ...o, x: o.x + dx, y: o.y + dy };
    }
    changed = true;
  });
  return changed ? out : elements;
}
