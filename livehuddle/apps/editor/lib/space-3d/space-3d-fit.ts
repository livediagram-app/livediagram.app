// Fit in the 3D view (docs/specs/008-canvas/3d-view.md "Fit frames the Space as it stands"): the tilted camera's
// perspective widens the plan's near edge and the walls stand up over its far edge, so the flat fit (the plan's box
// over the canvas) cropped the left and right of a wide Space. This fit frames the Space's box as the camera shows it,
// from the floor to the walls' tops. Pure: no React, no DOM.

import { FIT_TO_SCREEN_MAX_AT_FIT, FIT_TO_SCREEN_MIN } from '@liveworkspace/workbench/lib/viewport';
import { WALL_RISE } from '@/lib/real-3d/models/kit';
// space-3d-turn before space-3d-camera: they import each other, and the turn's tilt store reads the camera's resting
// tilt as it loads.
import { toCamera } from './space-3d-turn';
import { SPACE_3D_PERSPECTIVE_PX, screenBoxOf } from './space-3d-camera';
import { SPACE_WALL_HEIGHT } from './space-3d-walls';

type Rect = { x: number; y: number; width: number; height: number };
type View = { zoom: number; offset: { x: number; y: number } };

/** How tall the Space stands for a fit: a Room's wall as it stands, the tallest thing on a board. */
export const FIT_3D_TOP = SPACE_WALL_HEIGHT * WALL_RISE;

// A handful of steps settles it (each closes the zoom's and the centre's gap by most of the way).
const STEPS = 24;
// Keep every corner well in front of the camera: a point this close to the perspective's eye blows up.
const NEAR_LIMIT = 0.8;

/**
 * The view that frames `bbox` standing `top` canvas px tall, seen through the camera at `tiltDeg` and `turn`, inside the
 * canvas `size` less `pad` on each side (x left and right, y top and bottom), centred, at no more than `maxZoom`.
 */
export function fit3DView(
  size: { width: number; height: number },
  bbox: Rect,
  pad: { x: number; y: number },
  tiltDeg: number,
  turn = 0,
  top = FIT_3D_TOP,
  maxZoom = FIT_TO_SCREEN_MAX_AT_FIT,
  perspective = SPACE_3D_PERSPECTIVE_PX,
): View {
  const availW = Math.max(1, size.width - 2 * pad.x);
  const availH = Math.max(1, size.height - 2 * pad.y);
  const points: { x: number; y: number; z: number }[] = [];
  for (const x of [bbox.x, bbox.x + bbox.width])
    for (const y of [bbox.y, bbox.y + bbox.height])
      for (const z of [0, top]) points.push({ x, y, z });
  const clamp = (z: number) => Math.max(FIT_TO_SCREEN_MIN, Math.min(maxZoom, z));
  // From the flat fit.
  let zoom = clamp(Math.min(availW / Math.max(1, bbox.width), availH / Math.max(1, bbox.height)));
  const offset = {
    x: size.width / 2 - (bbox.x + bbox.width / 2),
    y: size.height / 2 - (bbox.y + bbox.height / 2),
  };
  const t = (tiltDeg * Math.PI) / 180;
  // Whether every corner stands well in front of the camera at this view.
  const inFront = () =>
    points.every((q) => {
      const f = toCamera(
        {
          x: (q.x + offset.x - size.width / 2) * zoom,
          y: (q.y + offset.y - size.height / 2) * zoom,
        },
        turn,
      );
      return f.y * Math.sin(t) + q.z * zoom * Math.cos(t) < perspective * NEAR_LIMIT;
    });
  for (let i = 0; i < STEPS; i++) {
    if (!inFront()) {
      zoom = clamp(zoom / 2);
      if (zoom === FIT_TO_SCREEN_MIN) break;
      continue;
    }
    const view = { zoom, offset };
    const box = screenBoxOf(points, size, view, tiltDeg, perspective, turn);
    // Centre it: the screen's miss, turned back onto the plan and taken out of the zoom.
    const miss = toCamera(
      {
        x: size.width / 2 - (box.x + box.width / 2),
        y: size.height / 2 - (box.y + box.height / 2),
      },
      -turn,
    );
    offset.x += miss.x / zoom;
    offset.y += miss.y / zoom;
    const ratio = Math.min(availW / Math.max(1, box.width), availH / Math.max(1, box.height));
    const next = clamp(zoom * ratio);
    const settled = Math.abs(next / zoom - 1) < 0.002 && Math.hypot(miss.x, miss.y) < 0.5;
    zoom = next;
    if (settled) break;
  }
  return { zoom, offset: { x: offset.x, y: offset.y } };
}

/** The side padding a fit keeps on a phone-narrow canvas, in screen px: the Space fills the width. */
export const FIT_3D_NARROW_PAD = 16;
/** Below this canvas width (screen px) a fit keeps the narrow side padding. */
export const FIT_3D_NARROW_WIDTH = 640;
