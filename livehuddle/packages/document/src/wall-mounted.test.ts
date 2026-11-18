import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { createOutlinedRoom } from './room-builder';
import { pieceFacing } from './furniture-facing';
import { mountsOnWall, snapMovedWallPieces, snapToWallFace, WALL_MOUNT_GAP } from './wall-mounted';
import type { Element, ShapeElement } from './index';

// A plain room 400 x 300 at the origin: back wall line at y 31, front at 295, sides at 5 and 395.
const room = {
  ...createShape('room', 0, 0),
  width: 400,
  height: 300,
  roomDoor: 'none',
} as ShapeElement;
const piece = (kind: string, x: number, y: number, extra: Partial<ShapeElement> = {}) =>
  ({ ...createShape(kind as never, x, y), ...extra }) as ShapeElement;

describe('mountsOnWall', () => {
  it('names the wall pieces only', () => {
    for (const k of ['fireplace', 'bookshelf', 'screen', 'notice-board', 'room-sign'])
      expect(mountsOnWall(k)).toBe(true);
    expect(mountsOnWall('chair')).toBe(false);
  });
});

describe('snapToWallFace', () => {
  it('leaves any other piece, and a board with no walls, alone', () => {
    const chair = piece('chair', 150, 150);
    expect(snapToWallFace(chair, [room, chair])).toBe(chair);
    const fire = piece('fireplace', 150, 150);
    expect(snapToWallFace(fire, [fire])).toBe(fire);
  });

  it('puts a fireplace in the middle of the floor against the nearest wall, its back to it', () => {
    const fire = piece('fireplace', 300, 150);
    const on = snapToWallFace(fire, [room, fire]);
    expect(pieceFacing(on)).toBe('e');
    expect(on.x + on.width).toBe(395 - WALL_MOUNT_GAP);
    // Placed again it stays.
    expect(snapToWallFace(on, [room, on])).toBe(on);
  });

  it('turns a fireplace near the front wall to put its back on it', () => {
    const fire = piece('fireplace', 160, 200);
    const on = snapToWallFace(fire, [room, fire]);
    expect(pieceFacing(on)).toBe('s');
    expect(on.y + on.height).toBe(295 - WALL_MOUNT_GAP);
  });

  it('hangs a screen on a back wall face near its top, and keeps it inside the span', () => {
    const screen = piece('screen', 100, 60);
    const on = snapToWallFace(screen, [room, screen]);
    expect(on.y).toBe(4);
    expect(on.x + on.width).toBeLessThanOrEqual(395);
  });

  it('stands a sign out from a side wall when that is nearest', () => {
    const sign = piece('room-sign', 60, 160);
    const on = snapToWallFace(sign, [room, sign]);
    expect(on.x).toBe(5 + WALL_MOUNT_GAP);
  });

  it('keeps a piece already on its wall where it is', () => {
    const sign = piece('room-sign', 150, 285);
    expect(snapToWallFace(sign, [room, sign])).toBe(sign);
  });

  it('centres a piece longer than its wall on it', () => {
    const tiny = { ...room, width: 60, height: 300 } as ShapeElement;
    const screen = piece('screen', -30, -200, { width: 120 });
    const on = snapToWallFace(screen, [tiny, screen]);
    expect(on.x).toBe(-30);
    expect(on.y + on.height).toBe(31 - WALL_MOUNT_GAP);
  });
});

describe('snapToWallFace on a drawn room', () => {
  it('takes only its straight walls, never a slanted one', () => {
    const tri = createOutlinedRoom([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 0, y: 400 },
    ])!;
    const fire = piece('fireplace', 120, 120);
    const on = snapToWallFace(fire, [tri, fire]);
    expect(['n', 'w']).toContain(pieceFacing(on));
  });
});

describe('snapMovedWallPieces', () => {
  it('snaps only the moved wall pieces, and keeps the array when none moves', () => {
    const fire = piece('fireplace', 300, 150);
    const chair = piece('chair', 100, 100);
    const els: Element[] = [room, fire, chair];
    expect(snapMovedWallPieces(els, new Set([chair.id]))).toBe(els);
    // A note, and a sign already on its wall, stay put.
    const note = { ...room, id: 'note', type: 'sticky' } as unknown as Element;
    const sign = piece('room-sign', 150, 285);
    const settled: Element[] = [room, note, sign];
    expect(snapMovedWallPieces(settled, new Set(['note', sign.id]))).toBe(settled);
    const out = snapMovedWallPieces(els, new Set([fire.id, chair.id]));
    expect(out).not.toBe(els);
    expect(out[2]).toBe(chair);
    expect(out[1]).not.toBe(fire);
  });
});
