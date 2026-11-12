// The camera that brings a game table close on a small screen (docs/specs/009-elements/social-pieces.md "On a small
// screen", Work Item 620): a phone that opened zoomed out to fit shows a Ping-Pong Table about 92 px wide, its score
// pills tiny. Sitting down to play glides in; this file says where to, or that the view is fine as it is. Pure.

import type { View } from '@liveworkspace/workbench/lib/viewport-store';

export const GAME_CAMERA = {
  /** A canvas this wide or wider is no small screen: its view is left alone. */
  narrowPx: 640,
  /** A table shown at least this wide (its longer side, on screen px) already reads. */
  minTablePx: 160,
  /** The share of the canvas's width the table is brought to. */
  widthShare: 0.6,
  /** ...and at most this share of its height, so a table on its side still fits. */
  heightShare: 0.5,
  /** Never closer than this. */
  maxZoom: 2,
} as const;

type Box = { x: number; y: number; width: number; height: number };

/**
 * The view to glide to when you sit down to play at `box` on a canvas `canvas` px in size, seen at `view`: the table
 * centred and brought close. Null when the canvas is wide, the table already reads, or the view is already as close.
 */
export function gameCameraView(
  box: Box,
  canvas: { width: number; height: number },
  view: View,
): View | null {
  if (canvas.width >= GAME_CAMERA.narrowPx || canvas.width <= 0 || canvas.height <= 0) return null;
  if (box.width <= 0 || box.height <= 0) return null;
  if (Math.max(box.width, box.height) * view.zoom >= GAME_CAMERA.minTablePx) return null;
  const zoom = Math.min(
    GAME_CAMERA.maxZoom,
    (canvas.width * GAME_CAMERA.widthShare) / box.width,
    (canvas.height * GAME_CAMERA.heightShare) / box.height,
  );
  if (zoom <= view.zoom) return null;
  // The canvas scales about its own centre, so the offset that centres a point is half the canvas less the point,
  // at any zoom (useAvatarCamera's centreAvatar).
  return {
    zoom,
    offset: {
      x: canvas.width / 2 - (box.x + box.width / 2),
      y: canvas.height / 2 - (box.y + box.height / 2),
    },
  };
}
