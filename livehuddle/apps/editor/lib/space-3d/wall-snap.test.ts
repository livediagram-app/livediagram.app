import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@livehuddle/templates';
import type { Element } from '@livehuddle/document';
import { spaceWalls } from './space-3d-walls';
import { WALL_SNAP_PX, snapsToWalls, wallSnap } from './wall-snap';

// docs/specs/008-canvas/3d-view.md "Editing in 3D": furniture snaps flush to a wall it comes near.
const room = {
  id: 'r',
  type: 'shape',
  shape: 'room',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
} as unknown as Element;

describe('wallSnap', () => {
  const back = spaceWalls([room]).find(
    (w) => w.id.startsWith('r:') && w.a.y === w.b.y && w.a.y < 100,
  )!;

  it('sets a piece near the back wall flush against its face', () => {
    const box = { x: 100, y: back.a.y + 5 + 10, width: 60, height: 40 };
    const { dx, dy } = wallSnap(box, [room], new Set());
    expect(dy).toBeCloseTo(-10, 6);
    expect(dx).toBeNull();
  });

  // The owner, 2026-11-27: "snap to walls, but on the inside not the outside unless I am facing the outside".
  it('snaps to the inside face, or the outside face when the view looks at the room from outside', () => {
    // Straddling the back wall, a little more outside than in: inside still wins while you look into the room.
    const box = { x: 100, y: back.a.y - 30, width: 60, height: 40 };
    const inside = wallSnap(box, [room], new Set(), 40, { x: 200, y: 150 });
    expect(box.y + inside.dy!).toBeCloseTo(back.a.y + 5, 6);
    const outside = wallSnap(box, [room], new Set(), 40, { x: 200, y: -200 });
    expect(box.y + box.height + outside.dy!).toBeCloseTo(back.a.y - 5, 6);
  });

  it('leaves a piece alone past the snap distance, or one beside no wall', () => {
    const far = { x: 100, y: back.a.y + 5 + WALL_SNAP_PX + 1, width: 60, height: 40 };
    expect(wallSnap(far, [room], new Set()).dy).toBeNull();
    const outside = { x: 900, y: back.a.y + 8, width: 60, height: 40 };
    expect(wallSnap(outside, [room], new Set()).dy).toBeNull();
  });

  it('never snaps a dragged room to its own walls', () => {
    const box = { x: 100, y: back.a.y + 8, width: 60, height: 40 };
    expect(wallSnap(box, [room], new Set(['r'])).dy).toBeNull();
  });

  it('is for furniture: a sofa snaps, a room and a note do not', () => {
    const office = buildTemplate('virtual-office', 0, 0);
    expect(office.some((el) => snapsToWalls(el))).toBe(true);
    expect(snapsToWalls(room)).toBe(false);
    expect(snapsToWalls({ id: 'n', type: 'sticky' } as unknown as Element)).toBe(false);
  });
});
