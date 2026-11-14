// Where a duplicate lands (docs/specs/008-canvas/canvas-and-palette.md "Duplicate", blueprint
// docs/specs/008-canvas/blueprints/duplicate-placement.md): in the nearest free spot beside the original, so the copy
// is plainly there. A fixed 24 px step down and right sat almost wholly on a large piece (an Arcade Machine), and it
// looked as if nothing happened (Work Tracker 636). Pure, so the rule is one testable answer.
//
// - A box (one piece, or a multi-selection as one group) tries right, below, left and above, a gap of PASTE_OFFSET
//   away, then the same four a step further out, up to DUPLICATE_SPOT_STEPS steps. A spot is free when the copy covers
//   no element but what the original stands inside (its Room, a zone, the floor). Inside a Room, a spot on that
//   Room's floor wins over a nearer one off it. With no free spot, the first one (right) is taken anyway.
// - A Room shares a wall with the original instead of standing a gap away (office.md "Rooms line up").
// - A Door or a Window on a wall slides along it to the nearest clear stretch, snapped by snapDoorToWall
//   (room-builder.md "A duplicate slides along the wall"); one standing free is placed as a box, then snapped.

import { ROOM_BACK_FACE, ROOM_WALL } from '@livehuddle/avatar/office-geometry';
import {
  elementBounds,
  isBoxed,
  isOutlinedRoom,
  isWallPiece,
  rectsIntersect,
  snapDoorToWall,
  wallUnder,
  type Element,
  type ElementId,
  type Rect,
  type ShapeElement,
  unionRects,
} from '@livehuddle/document';
import { PASTE_OFFSET } from '@/lib/paste-placement';

// How many steps out the search goes before it gives up and takes the first spot: four rings of four sides is 16
// tries, each a scan of the tab, so a crowded room of thousands of pieces still answers in a few milliseconds.
export const DUPLICATE_SPOT_STEPS = 4;

// The gap between the original and its copy: the paste offset, the gap livediagram's library inserts leave.
export const DUPLICATE_GAP = PASTE_OFFSET;

type Delta = { dx: number; dy: number };

// A rectangular Room (a Room Builder room's walls are not on its box, so it never shares one by its box).
const isBoxRoom = (el: Element): el is ShapeElement =>
  el.type === 'shape' && el.shape === 'room' && !isOutlinedRoom(el);

const area = (r: Rect) => r.width * r.height;

const contains = (outer: Rect, inner: Rect) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height;

// Where pieces stand inside a container: a Room's floor inside its walls (its back wall's face is deeper), anything
// else its whole box.
function floorOf(container: Element, box: Rect): Rect {
  if (!isBoxRoom(container)) return box;
  return {
    x: box.x + ROOM_WALL,
    y: box.y + ROOM_BACK_FACE,
    width: box.width - ROOM_WALL * 2,
    height: box.height - ROOM_BACK_FACE - ROOM_WALL,
  };
}

/**
 * The move that puts a copy of `box` (the original's own box, or a selection's union) in the nearest free spot beside
 * it. `sourceIds` are the originals: they block like any element but never count as what the copy stands inside.
 * `room` is a single rectangular Room's copy, which shares a wall with the original and may share its walls' strips
 * with any neighbour.
 */
export function duplicateOffset(
  box: Rect,
  elements: readonly Element[],
  sourceIds: ReadonlySet<ElementId>,
  room = false,
): Delta {
  const all = elements as Element[];
  const obstacles: Rect[] = [];
  let floor: Rect | null = null;
  let floorArea = Infinity;
  for (const el of elements) {
    if (!isBoxed(el)) continue;
    const r = elementBounds(el, all);
    if (!sourceIds.has(el.id) && contains(r, box)) {
      // What the original stands inside never blocks; the innermost one is the floor the copy prefers.
      if (area(r) < floorArea) {
        floorArea = area(r);
        floor = floorOf(el, r);
      }
      continue;
    }
    obstacles.push(r);
  }
  // A Room's copy steps a wall short (its wall on the original's), and its own walls may stand on a neighbour's.
  const gapX = room ? -ROOM_WALL : DUPLICATE_GAP;
  const gapY = room ? -ROOM_BACK_FACE : DUPLICATE_GAP;
  const insetX = room ? ROOM_WALL : 0;
  const insetY = room ? ROOM_BACK_FACE : 0;
  const stepX = box.width + gapX;
  const stepY = box.height + gapY;
  const candidates: Delta[] = [];
  for (let k = 1; k <= DUPLICATE_SPOT_STEPS; k++) {
    candidates.push(
      { dx: stepX * k, dy: 0 },
      { dx: 0, dy: stepY * k },
      { dx: -stepX * k, dy: 0 },
      { dx: 0, dy: -stepY * k },
    );
  }
  const at = (d: Delta): Rect => ({ ...box, x: box.x + d.dx, y: box.y + d.dy });
  const free = (d: Delta) => {
    const r = at(d);
    const probe = {
      x: r.x + insetX,
      y: r.y + insetY,
      width: Math.max(0, r.width - insetX * 2),
      height: Math.max(0, r.height - insetY * 2),
    };
    return !obstacles.some((o) => rectsIntersect(probe, o));
  };
  const freeSpots = candidates.filter(free);
  const onFloor = floor && freeSpots.find((d) => contains(floor, at(d)));
  return onFloor ?? freeSpots[0] ?? candidates[0]!;
}

// Two wall pieces overlap when their centres stand closer than half their widths together.
function clashes(piece: ShapeElement, elements: readonly Element[], skipId: ElementId): boolean {
  const cx = piece.x + piece.width / 2;
  const cy = piece.y + piece.height / 2;
  return elements.some(
    (el) =>
      el.id !== skipId &&
      isWallPiece(el) &&
      Math.hypot(el.x + el.width / 2 - cx, el.y + el.height / 2 - cy) <
        (el.width + piece.width) / 2,
  );
}

/**
 * A Door's or a Window's copy (`copy`, the original's fields under a fresh id) placed beside `source`: along the wall
 * the original stands on, the nearer side first, snapped onto it; else placed as a box and snapped onto a wall in reach.
 */
function placeWallPiece(
  source: ShapeElement,
  copy: ShapeElement,
  elements: readonly Element[],
): ShapeElement {
  const wall = wallUnder(source, elements);
  if (wall) {
    const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    const ux = (wall.b.x - wall.a.x) / len;
    const uy = (wall.b.y - wall.a.y) / len;
    const step = source.width + DUPLICATE_GAP;
    for (let k = 1; k <= DUPLICATE_SPOT_STEPS; k++) {
      for (const sign of [1, -1]) {
        const along = sign * step * k;
        const moved = { ...copy, x: source.x + ux * along, y: source.y + uy * along };
        const snapped = snapDoorToWall(moved, elements);
        if (wallUnder(snapped, elements) && !clashes(snapped, elements, copy.id)) return snapped;
      }
    }
  }
  const box = { x: source.x, y: source.y, width: source.width, height: source.height };
  const d = duplicateOffset(box, elements, new Set([source.id]));
  return snapDoorToWall({ ...copy, x: source.x + d.dx, y: source.y + d.dy }, elements);
}

/**
 * Where one piece's copy goes: `copy` (the original's fields under a fresh id, still at the original's spot) moved to
 * the nearest free spot beside `source`, a Room sharing a wall, a Door or a Window along its wall.
 */
export function placeDuplicate<T extends Element>(
  source: T,
  copy: T,
  elements: readonly Element[],
): T {
  if (!isBoxed(source) || !isBoxed(copy)) return copy;
  if (isWallPiece(source) && isWallPiece(copy)) return placeWallPiece(source, copy, elements) as T;
  const box = { x: source.x, y: source.y, width: source.width, height: source.height };
  const d = duplicateOffset(box, elements, new Set([source.id]), isBoxRoom(source));
  return { ...copy, x: source.x + d.dx, y: source.y + d.dy };
}

/** The move for a multi-selection's copies, as one group: the nearest free spot for the selection's whole box. */
export function groupDuplicateOffset(
  elements: readonly Element[],
  ids: ReadonlySet<ElementId>,
): Delta {
  const all = elements as Element[];
  const box = unionRects(
    elements.filter((el) => ids.has(el.id)).map((el) => elementBounds(el, all)),
  );
  if (!box) return { dx: DUPLICATE_GAP, dy: DUPLICATE_GAP };
  return duplicateOffset(box, elements, ids);
}
