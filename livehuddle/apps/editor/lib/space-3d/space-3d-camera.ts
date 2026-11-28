// The 3D view's camera (docs/specs/008-canvas/3d-view.md "The camera"; blueprint: 3d-view.md): the tilt and
// perspective the stage round the canvas's world layer carries, and the same projection worked backwards, so a press
// on the tilted floor walks to the floor point under it. Pure: no React, no DOM.

/** How far the camera looks back from straight down, in degrees (DEFAULTS.md D136). */
export const SPACE_3D_TILT_DEG = 52;
/** How far a right-drag tilts the camera: from nearly overhead to low over the floor (3d-view.md "Turning the camera"). */
export const SPACE_3D_TILT_RANGE: readonly [number, number] = [24, 70];
/** The perspective's distance, in screen px (DEFAULTS.md D136). */
export const SPACE_3D_PERSPECTIVE_PX = 1100;
/** How long the tilt (and the walls' fold) takes, in ms. */
export const SPACE_3D_TILT_MS = 520;

import { toCamera } from './space-3d-turn';

type Point = { x: number; y: number };
type View = { zoom: number; offset: Point };
type Rect = { left: number; top: number; width: number; height: number };

// Below this the press is at (or above) the horizon: the ray never meets the floor in front of the camera.
const HORIZON_EPSILON = 1;

/** The stage's transform while it is in 3D: the tilt itself is the `--space-tilt` variable, so it transitions. */
export function stageTransform(perspective = SPACE_3D_PERSPECTIVE_PX): string {
  return `perspective(${perspective}px) rotateX(var(--space-tilt)) rotateZ(var(--space-turn))`;
}

/**
 * The canvas point under a press on the tilted floor, or null above the horizon. `rect` is the canvas's (the
 * stage's) box on the screen; the stage tilts about its centre, and the world layer inside it is the flat view's
 * `scale(zoom) translate(offset)` about the same centre. At a tilt of 0 it is `pointerToCanvas`.
 */
export function floorPointAt(
  client: Point,
  rect: Rect,
  view: View,
  tiltDeg: number,
  perspective = SPACE_3D_PERSPECTIVE_PX,
  // The camera's quarter turns (3d-view.md "Turning the camera"): the floor point is turned back by them.
  turn = 0,
): Point | null {
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const X = client.x - rect.left - cx;
  const Y = client.y - rect.top - cy;
  const t = (tiltDeg * Math.PI) / 180;
  const sin = Math.sin(t);
  const den = perspective * Math.cos(t) + Y * sin;
  if (den <= HORIZON_EPSILON) return null;
  const fy = (Y * perspective) / den;
  const fx = (X * (perspective - fy * sin)) / perspective;
  const p = toCamera({ x: fx, y: fy }, -turn);
  return { x: p.x / view.zoom + cx - view.offset.x, y: p.y / view.zoom + cy - view.offset.y };
}

/** Where a canvas point on the floor shows on the screen (relative to the canvas's box): `floorPointAt` forwards. */
export function screenPointOf(
  point: Point,
  size: { width: number; height: number },
  view: View,
  tiltDeg: number,
  perspective = SPACE_3D_PERSPECTIVE_PX,
  turn = 0,
): Point {
  return screenPointAbove(point, 0, size, view, tiltDeg, perspective, turn);
}

/** Where a point `z` canvas px above a floor point shows on the screen (relative to the canvas's box). */
export function screenPointAbove(
  point: Point,
  z: number,
  size: { width: number; height: number },
  view: View,
  tiltDeg: number,
  perspective = SPACE_3D_PERSPECTIVE_PX,
  turn = 0,
): Point {
  const cx = size.width / 2;
  const cy = size.height / 2;
  const { x: fx, y: fy } = toCamera(
    {
      x: (point.x + view.offset.x - cx) * view.zoom,
      y: (point.y + view.offset.y - cy) * view.zoom,
    },
    turn,
  );
  const t = (tiltDeg * Math.PI) / 180;
  const h = z * view.zoom;
  // rotateX(tilt) of (fx, fy, h): the height leans back up the screen and toward the camera.
  const depth = fy * Math.sin(t) + h * Math.cos(t);
  const w = perspective / (perspective - depth);
  return { x: cx + fx * w, y: cy + (fy * Math.cos(t) - h * Math.sin(t)) * w };
}

/** The screen box (relative to the canvas's box) round points standing above the floor (x, y canvas; z height). */
export function screenBoxOf(
  points: readonly { x: number; y: number; z: number }[],
  size: { width: number; height: number },
  view: View,
  tiltDeg: number,
  perspective = SPACE_3D_PERSPECTIVE_PX,
  turn = 0,
): { x: number; y: number; width: number; height: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of points) {
    const p = screenPointAbove(q, q.z, size, view, tiltDeg, perspective, turn);
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * The screen box (relative to the canvas's box) round a floor rect standing `z` canvas px tall, as the tilted, turned
 * camera shows it: what a toolbar over a piece in the 3D view is placed against.
 */
export function screenRectOf(
  rect: { x: number; y: number; width: number; height: number },
  z: number,
  size: { width: number; height: number },
  view: View,
  tiltDeg: number,
  perspective = SPACE_3D_PERSPECTIVE_PX,
  turn = 0,
): { x: number; y: number; width: number; height: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const px of [rect.x, rect.x + rect.width])
    for (const py of [rect.y, rect.y + rect.height])
      for (const h of z > 0 ? [0, z] : [0]) {
        const p = screenPointAbove({ x: px, y: py }, h, size, view, tiltDeg, perspective, turn);
        x0 = Math.min(x0, p.x);
        y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x);
        y1 = Math.max(y1, p.y);
      }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Where something standing upright at a floor point shows in the tilted view, from where the flat view shows that
 * point (`flat`, relative to the canvas's box): how far it moves on the screen and how much it scales about the point.
 * An upright card facing the camera lies at one depth, so the perspective scales it evenly (3d-view.md "The overlay").
 */
export function standingShift(
  flat: Point,
  size: { width: number; height: number },
  tiltDeg: number,
  perspective = SPACE_3D_PERSPECTIVE_PX,
): { dx: number; dy: number; scale: number } {
  const fx = flat.x - size.width / 2;
  const fy = flat.y - size.height / 2;
  const t = (tiltDeg * Math.PI) / 180;
  const w = perspective / (perspective - fy * Math.sin(t));
  return { dx: fx * (w - 1), dy: fy * (Math.cos(t) * w - 1), scale: w };
}
