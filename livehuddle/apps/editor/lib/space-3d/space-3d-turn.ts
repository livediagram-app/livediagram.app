// The 3D view's quarter turns (docs/specs/008-canvas/3d-view.md "Turning the camera"): how many quarter turns the
// camera has made, this tab only (never synced or remembered), and the plan seen from the turned camera. A turn of q
// quarters turns the floor q × 90° clockwise on the screen, so what is nearest the camera (the screen's bottom) is the
// plan's south at 0, its east at 1, its north at 2 and its west at 3. Pure apart from the one store.

import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import { setArrowTurn } from '@livehuddle/avatar/arrow-turn';
import { track } from '@/lib/telemetry';
import { SPACE_3D_TILT_DEG, SPACE_3D_TILT_RANGE } from './space-3d-camera';

/** Quarter turns made, unbounded (turning on past a full turn keeps going round); any fraction after a right-drag. */
export const space3DTurn = createStateStore<number>(0);
/**
 * The camera's tilt from looking straight down, in degrees (3d-view.md "Turning the camera"): SPACE_3D_TILT_DEG until a
 * right-drag up or down changes it, within SPACE_3D_TILT_RANGE, this tab only.
 */
export const space3DTilt = createStateStore<number>(SPACE_3D_TILT_DEG);

/** Sets the camera's tilt, held within its range. */
export function setSpace3DTilt(deg: number): void {
  const [lo, hi] = SPACE_3D_TILT_RANGE;
  const next = Math.min(hi, Math.max(lo, deg));
  if (space3DTilt.get() !== next) space3DTilt.set(next);
}

/** Whether the canvas's 3D view is mounted: a piece turned on the plan is drawn as the camera sees it only then. */
export const space3DShowing = createStateStore<boolean>(false);

/** Turns the camera a quarter turn: -1 left, 1 right. The camera going right round you turns the floor the other way. */
export function turnSpace3D(by: -1 | 1): void {
  const now = space3DTurn.get();
  // From between quarters (a right-drag let go), on to the next quarter that way.
  const next = Number.isInteger(now) ? now - by : by > 0 ? Math.floor(now) : Math.ceil(now);
  track('Canvas', 'Used', 'Space3DTurn');
  space3DTurn.set(next);
  setArrowTurn(Math.round(next));
}

/** Sets the camera's turn to any angle, in quarters (a right-drag, 3d-view.md "Turning the camera"). */
export function setSpace3DTurn(quarters: number): void {
  if (space3DTurn.get() === quarters) return;
  space3DTurn.set(quarters);
  setArrowTurn(Math.round(quarters));
}

/** Back to looking up the screen at the resting tilt (a new tab). */
export function resetSpace3DTurn(): void {
  if (space3DTilt.get() !== SPACE_3D_TILT_DEG) space3DTilt.set(SPACE_3D_TILT_DEG);
  if (space3DTurn.get() === 0) return;
  space3DTurn.set(0);
  setArrowTurn(0);
}

/** A turn's nearest quarter, 0 to 3 (a free turn takes the quarter it is closest to). */
export function turnQuarter(q: number): 0 | 1 | 2 | 3 {
  const r = Math.round(q);
  return (((r % 4) + 4) % 4) as 0 | 1 | 2 | 3;
}

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };

/** A plan point as the turned camera sees it: turned q quarters clockwise about the origin (the screen's own way). */
export function toCamera(p: Point, q: number): Point {
  if (!Number.isInteger(q)) {
    // A free turn: q quarters clockwise, at any angle.
    const a = (q * Math.PI) / 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
  }
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
 * floor, so dragging up always moves the floor up the screen, whichever way the camera looks. Unturned, it is unchanged.
 */
export function screenToPlan(d: Point, q = space3DTurn.get()): Point {
  return toCamera(d, -q);
}

/** A plan box as the turned camera sees it: its four corners turned, boxed again. */
export function boxToCamera(b: Box, q: number): Box {
  // A box stays a box: a free turn takes its nearest quarter.
  q = Math.round(q);
  if (turnQuarter(q) === 0) return b;
  const a = toCamera({ x: b.x, y: b.y }, q);
  const c = toCamera({ x: b.x + b.width, y: b.y + b.height }, q);
  const x = Math.min(a.x, c.x);
  const y = Math.min(a.y, c.y);
  return { x, y, width: Math.abs(c.x - a.x), height: Math.abs(c.y - a.y) };
}
