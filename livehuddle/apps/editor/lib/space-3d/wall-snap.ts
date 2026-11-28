// Furniture snaps to walls (docs/specs/008-canvas/3d-view.md "Editing in 3D"): a piece dragged near a Room's,
// Corridor's or Pod's wall, a window or a fence lands flush against the wall's face, so it lines up without fiddling
// (the owner, 2026-11-27: "it should snap to the wall so I can easily place it right"). Pure, canvas px.

import { isFurnitureShape, type Element } from '@livehuddle/document';
import { standsIn3D } from './space-3d-pieces';
import { spaceWalls, type SpaceWall } from './space-3d-walls';

/** How near (canvas px) a piece's edge must come to a wall's face to snap to it: wider than an alignment snap. */
export const WALL_SNAP_PX = 18;

/** Half of how thick each kind of wall stands (scene-walls.ts WALL_THICKNESS), plus the skirting's lip on a wall. */
const HALF: Partial<Record<SpaceWall['kind'], number>> = {
  wall: 5,
  window: 5,
  glass: 2,
  fence: 3,
  picket: 2,
};

type Box = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

/** The unturned box a wall belongs to (a Room's, a Corridor's, a Pod's), or null (a fence, a turned room). */
function ownerBox(elements: readonly Element[], id: string): Box | null {
  const el = elements.find((e) => e.id === id);
  if (
    !el ||
    el.type !== 'shape' ||
    el.rotation ||
    el.shape === 'fence' ||
    el.shape === 'garden-fence'
  )
    return null;
  return { x: el.x, y: el.y, width: el.width, height: el.height };
}

const inBox = (p: Point, b: Box) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

const wallsOf = new WeakMap<readonly Element[], SpaceWall[]>();

function solidWalls(elements: readonly Element[]): SpaceWall[] {
  let walls = wallsOf.get(elements);
  if (!walls) {
    walls = spaceWalls(elements).filter((w) => HALF[w.kind] !== undefined);
    wallsOf.set(elements, walls);
  }
  return walls;
}

/** Whether dragging this element snaps it to walls: a piece of furniture, not a room, a fence or what lies flat. */
export function snapsToWalls(el: Element | undefined): boolean {
  return !!el && standsIn3D(el) && isFurnitureShape(el.shape);
}

/**
 * The nudge (per axis, null where no wall is near) that sets a box's nearest edge flush against a wall face it comes
 * within `threshold` of. A wall counts only where it runs beside the box (they overlap along the wall), and only an
 * upright or level wall (a turned room's walls are left to the alignment snap). `skip` ids are the dragged pieces,
 * whose own walls (a dragged room's) never snap them.
 *
 * A room's wall snaps a piece to its inside face, unless you are looking at the room from outside (`viewer`, the floor
 * point the view looks at, is outside it): then to its outside face (the owner, 2026-11-27: "snap to walls, but on the
 * inside not the outside unless I am facing the outside"). A fence has no inside: either face.
 */
export function wallSnap(
  box: Box,
  elements: readonly Element[],
  skip: ReadonlySet<string>,
  threshold = WALL_SNAP_PX,
  viewer: Point | null = null,
): { dx: number | null; dy: number | null } {
  let dx: number | null = null;
  let dy: number | null = null;
  const consider = (d: number, axis: 'x' | 'y') => {
    if (Math.abs(d) > threshold) return;
    if (axis === 'x' && (dx === null || Math.abs(d) < Math.abs(dx))) dx = d;
    if (axis === 'y' && (dy === null || Math.abs(d) < Math.abs(dy))) dy = d;
  };
  for (const w of solidWalls(elements)) {
    const owner = w.id.split(':')[0]!;
    if (skip.has(owner)) continue;
    const half = HALF[w.kind]!;
    const room = ownerBox(elements, owner);
    // Which side of the wall a piece may snap on: +1 the side toward larger x or y, -1 the other, 0 either.
    const side = (at: number, mid: number) => {
      if (!room) return 0;
      const inward = Math.sign(mid - at) || 1;
      return !viewer || inBox(viewer, room) ? inward : -inward;
    };
    if (Math.abs(w.a.y - w.b.y) < 0.5) {
      // Level: it runs along x at y.
      const lo = Math.min(w.a.x, w.b.x);
      const hi = Math.max(w.a.x, w.b.x);
      if (box.x + box.width <= lo || box.x >= hi) continue;
      const y = w.a.y;
      const s = side(y, room ? room.y + room.height / 2 : y);
      if (s >= 0) consider(y + half - box.y, 'y');
      if (s <= 0) consider(y - half - (box.y + box.height), 'y');
    } else if (Math.abs(w.a.x - w.b.x) < 0.5) {
      const lo = Math.min(w.a.y, w.b.y);
      const hi = Math.max(w.a.y, w.b.y);
      if (box.y + box.height <= lo || box.y >= hi) continue;
      const x = w.a.x;
      const s = side(x, room ? room.x + room.width / 2 : x);
      if (s >= 0) consider(x + half - box.x, 'x');
      if (s <= 0) consider(x - half - (box.x + box.width), 'x');
    }
  }
  return { dx, dy };
}
