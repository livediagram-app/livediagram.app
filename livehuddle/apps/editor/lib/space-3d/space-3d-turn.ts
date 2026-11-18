// The 3D view's quarter turns (docs/specs/008-canvas/3d-view.md "Turning the camera"): how many quarter turns the
// camera has made, this tab only (never synced or remembered), and the plan seen from the turned camera. A turn of q
// quarters turns the floor q × 90° clockwise on the screen, so what is nearest the camera (the screen's bottom) is the
// plan's south at 0, its east at 1, its north at 2 and its west at 3. Pure apart from the one store.

import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import { setArrowTurn } from '@livehuddle/avatar/arrow-turn';
import { track } from '@/lib/telemetry';

/** Quarter turns made, unbounded (turning on past a full turn keeps going round). */
export const space3DTurn = createStateStore<number>(0);
/** Whether the 3D view shows (any phase but flat): a piece turned on the plan is drawn as the camera sees it only then. */
export const space3DShowing = createStateStore<boolean>(false);

/** Turns the camera a quarter turn: -1 left, 1 right. The camera going right round you turns the floor the other way. */
export function turnSpace3D(by: -1 | 1): void {
  const next = space3DTurn.get() - by;
  track('Canvas', 'Used', 'Space3DTurn');
  space3DTurn.set(next);
  setArrowTurn(next);
}

/** Back to looking up the screen (the view went flat). */
export function resetSpace3DTurn(): void {
  if (space3DTurn.get() === 0) return;
  space3DTurn.set(0);
  setArrowTurn(0);
}

/** A turn's quarter, 0 to 3. */
export function turnQuarter(q: number): 0 | 1 | 2 | 3 {
  return (((q % 4) + 4) % 4) as 0 | 1 | 2 | 3;
}

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };

/** A plan point as the turned camera sees it: turned q quarters clockwise about the origin (the screen's own way). */
export function toCamera(p: Point, q: number): Point {
  switch (turnQuarter(q)) {
    case 0:
      return p;
    case 1:
      return { x: -p.y, y: p.x };
    case 2:
      return { x: -p.x, y: -p.y };
    case 3:
      return { x: p.y, y: -p.x };
  }
}

/**
 * A drag on the screen as a move on the plan (3d-view.md "Turning the camera"): a pan follows your hand on the turned
 * floor, so dragging up always moves the floor up the screen, whichever way the camera looks. Flat, it is unchanged.
 */
export function screenToPlan(d: Point, q = space3DTurn.get()): Point {
  return toCamera(d, -q);
}

/** A plan box as the turned camera sees it: its four corners turned, boxed again. */
export function boxToCamera(b: Box, q: number): Box {
  if (turnQuarter(q) === 0) return b;
  const a = toCamera({ x: b.x, y: b.y }, q);
  const c = toCamera({ x: b.x + b.width, y: b.y + b.height }, q);
  const x = Math.min(a.x, c.x);
  const y = Math.min(a.y, c.y);
  return { x, y, width: Math.abs(c.x - a.x), height: Math.abs(c.y - a.y) };
}

/**
 * Whether the turned camera sees a wall's face from behind (3d-view.md "Turning the camera"): a wall from `a` to `b`
 * faces the camera unturned, so its room name is mirrored back to read the right way round from the other side.
 */
export function seenFromBehind(wall: { a: Point; b: Point }, q: number): boolean {
  const normal = { x: -(wall.b.y - wall.a.y), y: wall.b.x - wall.a.x };
  return toCamera(normal, q).y < 0;
}
