// A Corridor's Doors through a change of its type (docs/specs/009-elements/office.md "A piece's type", "A Corridor's
// Doors move to its new walls", Work Tracker 1453). A new type has different walls, so the Doors and Windows that
// stood on the old ones are put on the nearest stretch of the new ones long enough to hold them, never on top of
// another; one no wall can hold is removed and counted, so the editor can say so. Pure: no React, no DOM.

import { nearestWall } from '@livehuddle/avatar/room-outline';
import type { Element, ElementId, ShapeElement } from './index';
import { corridorWalls, pieceVariant } from './piece-variants';
import { isWallPiece, onRoomWall, snapDoorToWall } from './room-builder';

/** How many Doors and Windows a type change removed because no new wall could hold them. */
export type RemovedWallPieces = { doors: number; windows: number };

const isCorridor = (el: Element): el is ShapeElement =>
  el.type === 'shape' && el.shape === 'corridor';

const isWalled = (el: Element): el is ShapeElement =>
  el.type === 'shape' && (el.shape === 'room' || el.shape === 'corridor');

const centreOf = (el: ShapeElement) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

// Two wall pieces overlap when their centres stand closer than half their widths together (duplicate-placement.ts).
function clashes(piece: ShapeElement, others: readonly ShapeElement[]): boolean {
  const c = centreOf(piece);
  return others.some((o) => {
    const d = centreOf(o);
    return Math.hypot(d.x - c.x, d.y - c.y) < (o.width + piece.width) / 2;
  });
}

// `piece` put on the corridor's nearest wall run that holds it and is clear of `others`, or null when none does.
function reseat(
  piece: ShapeElement,
  corridor: ShapeElement,
  others: readonly ShapeElement[],
): ShapeElement | null {
  const centre = centreOf(piece);
  const half = piece.width / 2;
  const spots = corridorWalls(corridor)
    .filter((w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) >= piece.width)
    .map((w) => nearestWall(centre, [w], Infinity, half)!)
    .map((hit) => ({ at: hit.at, dist: Math.hypot(hit.at.x - centre.x, hit.at.y - centre.y) }))
    .sort((p, q) => p.dist - q.dist);
  for (const { at } of spots) {
    const moved = snapDoorToWall({ ...piece, x: at.x - half, y: at.y - piece.height / 2 }, [
      corridor,
    ]);
    if (!clashes(moved, others)) return moved;
  }
  return null;
}

/**
 * `after` (the board with some corridors retyped from `before`) with the Doors and Windows that stood on each retyped
 * corridor's old walls re-seated on its new ones, in board order, and the ones no new wall holds removed. A piece that
 * also stands on another room's or corridor's wall stays where it is. `elements` is `after` itself when no retyped
 * corridor had a wall piece on it.
 */
export function retypeCorridorDoors(
  before: readonly Element[],
  after: Element[],
): { elements: Element[]; removed: RemovedWallPieces } {
  const removed: RemovedWallPieces = { doors: 0, windows: 0 };
  const was = new Map<ElementId, ShapeElement>();
  for (const el of before) if (isCorridor(el)) was.set(el.id, el);
  const retyped: { from: ShapeElement; to: ShapeElement }[] = [];
  for (const el of after) {
    if (!isCorridor(el)) continue;
    const from = was.get(el.id);
    if (from && pieceVariant(from) !== pieceVariant(el)) retyped.push({ from, to: el });
  }
  if (retyped.length === 0) return { elements: after, removed };
  const retypedIds = new Set(retyped.map((r) => r.to.id));
  const others = after.filter((el) => isWalled(el) && !retypedIds.has(el.id)) as ShapeElement[];
  // Which corridor each moving piece rides; a piece also on a wall that stays put does not move.
  const rides = new Map<ElementId, ShapeElement>();
  for (const el of after) {
    if (!isWallPiece(el)) continue;
    const hit = retyped.find(({ from }) => onRoomWall(el, from));
    if (!hit || others.some((o) => onRoomWall(el, o))) continue;
    rides.set(el.id, hit.to);
  }
  if (rides.size === 0) return { elements: after, removed };
  // The wall pieces that stay put, then each one re-seated before the next, so none lands on another.
  const standing = after.filter((el): el is ShapeElement => isWallPiece(el) && !rides.has(el.id));
  const out: Element[] = [];
  for (const el of after) {
    const corridor = rides.get(el.id);
    if (!corridor || !isWallPiece(el)) {
      out.push(el);
      continue;
    }
    const seated = reseat(el, corridor, standing);
    if (seated) {
      standing.push(seated);
      out.push(seated);
    } else if (el.shape === 'window') removed.windows++;
    else removed.doors++;
  }
  return { elements: out, removed };
}
