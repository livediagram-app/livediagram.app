// What floats over a character turns to face the camera in livehuddle's 3D view (docs/specs/008-canvas/3d-view.md
// "What it shows"), about that character's feet rather than its own anchor, so it stays over the head it belongs to as
// the character stands up. An element marked `data-space-billboard` carries the feet as its transform origin, written
// from its own box: `x` and `y` are the box's anchor (a CSS length or percentage, `50%` and `100%` for a box hung
// above its anchor), and `dx` and `dy` how far the feet are from that anchor, in canvas px. Flat, nothing reads it.

import type { CSSProperties } from 'react';

export const SPACE_BILLBOARD_ATTR = { 'data-space-billboard': '' } as const;

export function billboardOrigin(
  dx: number,
  dy: number,
  x = '50%',
  y = '100%',
): CSSProperties {
  return { '--space-billboard-origin': `calc(${x} + ${dx}px) calc(${y} + ${dy}px)` } as CSSProperties;
}
