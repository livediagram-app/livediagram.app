// A press on a room's floor in Real 3D (docs/specs/008-canvas/3d-view.md "Editing in 3D"): a Room and a Corridor are
// drawn as floor and walls, not as a piece's model, so a press that meets no model but lands on one's floor picks it,
// the smallest when they overlap (the room inside a wing). Pure: the elements and the floor point the press met.

import type { Element, ShapeElement } from '@livehuddle/document';

/** The kinds a press on their floor selects. */
const FLOORED = new Set(['room', 'corridor']);

type Pt = { x: number; y: number };

/** The point turned back into the element's own upright frame (it turns about its middle). */
function upright(el: ShapeElement, p: Pt): Pt {
  const turn = ((el.rotation ?? 0) * Math.PI) / 180;
  if (!turn) return p;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const c = Math.cos(-turn);
  const s = Math.sin(-turn);
  const dx = p.x - cx;
  const dy = p.y - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}

function inPolygon(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

function onFloor(el: ShapeElement, at: Pt): boolean {
  const p = upright(el, at);
  const u = (p.x - el.x) / el.width;
  const v = (p.y - el.y) / el.height;
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return false;
  const outline = (el as { roomOutline?: readonly Pt[] }).roomOutline;
  return outline && outline.length >= 3 ? inPolygon({ x: u, y: v }, outline) : true;
}

/** The id of the smallest Room or Corridor whose floor holds the point, or null. */
export function floorPieceAt(elements: readonly Element[], at: Pt): string | null {
  let best: { id: string; area: number } | null = null;
  for (const el of elements) {
    if (el.type !== 'shape' || !FLOORED.has(el.shape) || el.width <= 0 || el.height <= 0) continue;
    if (!onFloor(el, at)) continue;
    const area = el.width * el.height;
    if (!best || area < best.area) best = { id: el.id, area };
  }
  return best?.id ?? null;
}
