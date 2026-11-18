// Which walls the 3D view draws and which it cuts away (docs/specs/008-canvas/3d-view.md "Walls in front of you are
// cut away", "Performance"; blueprint: 3d-view.md). Pure: no React, no DOM.

import { toCamera } from './space-3d-turn';
import type { SpaceWall } from './space-3d-walls';

/** How far to either side of your feet a wall in front of you is cut away, in canvas px (DEFAULTS.md D138). */
export const SPACE_CUT_HALF_WIDTH = 72;
/** How far in front of your feet (down the screen) a wall is cut away, in canvas px (DEFAULTS.md D138). */
export const SPACE_CUT_DEPTH = 150;
/** A cut-away wall's opacity. */
export const SPACE_CUT_OPACITY = 0.18;

// The area drawn, in screens at the zoom (DEFAULTS.md D139).
export const SPACE_AREA_SIDE = 1.5;
export const SPACE_AREA_AHEAD = 3;
export const SPACE_AREA_BEHIND = 1.5;

type Point = { x: number; y: number };

export type SpaceArea = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  // The canvas point at the screen's middle and the zoom the area was worked out at.
  centre: Point;
  zoom: number;
  width: number;
  height: number;
};

/** Whether part of a wall lies in front of the feet, within the cut-away box. */
function inFront(wall: SpaceWall, feet: Point): boolean {
  const left = feet.x - SPACE_CUT_HALF_WIDTH;
  const right = feet.x + SPACE_CUT_HALF_WIDTH;
  const top = feet.y;
  const bottom = feet.y + SPACE_CUT_DEPTH;
  return segmentMeetsBox(wall.a, wall.b, left, top, right, bottom);
}

// Liang-Barsky: does the segment a-b pass through the box?
function segmentMeetsBox(
  a: Point,
  b: Point,
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const edges: [number, number][] = [
    [-dx, a.x - left],
    [dx, right - a.x],
    [-dy, a.y - top],
    [dy, bottom - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** The ids of the walls standing in front of your feet, which fade so they never hide you. None without feet. */
export function cutAwayIds(
  walls: readonly SpaceWall[],
  feet: Point | null,
  // The camera's quarter turns (3d-view.md "Turning the camera"): in front is the camera's way.
  turn = 0,
): Set<string> {
  const out = new Set<string>();
  if (!feet) return out;
  const f = toCamera(feet, turn);
  // Blades of grass are too low to hide anyone: never cut.
  for (const wall of walls) {
    if (wall.kind === 'grass') continue;
    const seen = { ...wall, a: toCamera(wall.a, turn), b: toCamera(wall.b, turn) };
    if (inFront(seen, f)) out.add(wall.id);
  }
  return out;
}

/** The canvas area whose walls are drawn, for a view on a canvas of `size`. */
export function viewArea(
  view: { zoom: number; offset: Point },
  size: { width: number; height: number },
): SpaceArea {
  const w = size.width / view.zoom;
  const h = size.height / view.zoom;
  // The canvas point at the screen's middle: the flat view's `scale(zoom) translate(offset)` about the centre.
  const centre = { x: size.width / 2 - view.offset.x, y: size.height / 2 - view.offset.y };
  return {
    left: centre.x - w * SPACE_AREA_SIDE,
    right: centre.x + w * SPACE_AREA_SIDE,
    top: centre.y - h * SPACE_AREA_AHEAD,
    bottom: centre.y + h * SPACE_AREA_BEHIND,
    centre,
    zoom: view.zoom,
    width: size.width,
    height: size.height,
  };
}

/**
 * The area for a turned camera (3d-view.md "Turning the camera"): ahead may be any side, so from the same middle it
 * reaches as far as ahead does every way.
 */
export function turnedArea(area: SpaceArea): SpaceArea {
  const reach = (Math.max(area.width, area.height) / area.zoom) * SPACE_AREA_AHEAD;
  const { centre } = area;
  return {
    ...area,
    left: centre.x - reach,
    right: centre.x + reach,
    top: centre.y - reach,
    bottom: centre.y + reach,
  };
}

/** The walls whose bounding box meets the area. */
export function wallsInArea(walls: readonly SpaceWall[], area: SpaceArea): SpaceWall[] {
  return walls.filter(
    (w) =>
      Math.max(w.a.x, w.b.x) >= area.left &&
      Math.min(w.a.x, w.b.x) <= area.right &&
      Math.max(w.a.y, w.b.y) >= area.top &&
      Math.min(w.a.y, w.b.y) <= area.bottom,
  );
}

/**
 * Whether the drawn area is due to be chosen again: the view's middle has moved a quarter of the area's side from
 * where it was chosen, or the zoom or the canvas's size has changed.
 */
export function areaMovedFar(area: SpaceArea, next: SpaceArea): boolean {
  if (area.zoom !== next.zoom || area.width !== next.width || area.height !== next.height)
    return true;
  const w = area.width / area.zoom;
  const h = area.height / area.zoom;
  return (
    Math.abs(next.centre.x - area.centre.x) > (w * SPACE_AREA_SIDE) / 2 ||
    Math.abs(next.centre.y - area.centre.y) > (h * SPACE_AREA_BEHIND) / 2
  );
}
