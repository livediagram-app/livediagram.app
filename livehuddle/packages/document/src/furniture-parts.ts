// The part builders every office drawing module writes its tables with (office.ts, office-garden.ts, office-social.ts,
// office-recreation.ts, office-wayfinding.ts): one rect, ellipse or path in the furniture's vocabulary (seating.ts),
// with its own fill or none (the seat's colour), and a drawing that reads the same from every side. Pure.

import type { FurnitureArt, FurnitureDrawing, FurniturePart, FurniturePartRole } from './seating';

export const rect = (
  role: FurniturePartRole,
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  fill?: string,
): FurniturePart => ({ tag: 'rect', role, x, y, w, h, rx, ...(fill ? { fill } : {}) });

export const ellipse = (
  role: FurniturePartRole,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill?: string,
): FurniturePart => ({ tag: 'ellipse', role, cx, cy, rx, ry, ...(fill ? { fill } : {}) });

export const path = (role: FurniturePartRole, d: string, fill?: string): FurniturePart => ({
  tag: 'path',
  role,
  d,
  ...(fill ? { fill } : {}),
});

/** A drawing that reads the same from every side, so every facing shows it. */
export const allSides = (view: FurnitureDrawing): FurnitureArt => ({
  front: view,
  back: view,
  side: view,
});
