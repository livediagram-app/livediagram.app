import { describe, expect, it } from 'vitest';
import { fenceSegments, fenceStep } from './collision';
import { roomWalls } from './office-geometry';

// docs/specs/009-elements/office.md "A Room turns" (Work Tracker 1454): a turned room's walls block where they are
// drawn, turned about its centre, and a Door on a turned wall lets a character through.
const room = (over: Record<string, unknown> = {}) => ({
  id: 'r',
  type: 'shape',
  shape: 'room',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  roomDoor: 'none' as const,
  ...over,
});

// Turned a quarter clockwise about its centre (200, 150), the room's left wall (x = 5) lies along y = -45, from
// x = 50 to x = 350, and its front wall (y = 295) stands at x = 55.
const LEFT_WALL_Y = -45;

describe('a turned room', () => {
  it('turns its walls about its centre, and leaves an upright one as it was', () => {
    expect(roomWalls(room({ rotation: 0 }))).toEqual(roomWalls(room()));
    expect(roomWalls(room({ rotation: 360 }))).toEqual(roomWalls(room()));
    const left = roomWalls(room({ rotation: 90 }))[2]!;
    expect(left.a.y).toBeCloseTo(LEFT_WALL_Y);
    expect(left.b.y).toBeCloseTo(LEFT_WALL_Y);
    expect(Math.min(left.a.x, left.b.x)).toBeCloseTo(50);
    expect(Math.max(left.a.x, left.b.x)).toBeCloseTo(350);
  });

  it('blocks a walk into a turned wall where it is drawn, not where the upright room stood', () => {
    const turned = fenceSegments([room({ rotation: 90 })]);
    const upright = fenceSegments([room()]);
    // Up through the turned left wall: refused; the upright room had nothing there.
    const across = [
      { x: 200, y: -20 },
      { x: 200, y: -70 },
    ] as const;
    expect(fenceStep(across[0], across[1], turned).blocked).toBe(true);
    expect(fenceStep(across[0], across[1], upright).blocked).toBe(false);
    // Through where the upright room's right wall stood (x = 395): open floor now.
    const old = [
      { x: 380, y: 150 },
      { x: 420, y: 150 },
    ] as const;
    expect(fenceStep(old[0], old[1], turned).blocked).toBe(false);
    expect(fenceStep(old[0], old[1], upright).blocked).toBe(true);
  });

  it('slides a walk along a turned wall, the way it slides along any wall', () => {
    const turned = fenceSegments([room({ rotation: 90 })]);
    // A diagonal step into the wall from inside keeps its run along the wall.
    const step = fenceStep({ x: 200, y: -20 }, { x: 230, y: -50 }, turned);
    expect(step.blocked).toBe(true);
    expect(step.pos.x).toBeGreaterThan(200);
    expect(step.pos.y).toBeGreaterThan(LEFT_WALL_Y);
  });

  it('lets a character through a Door standing on the turned wall', () => {
    const door = {
      id: 'd',
      type: 'shape',
      shape: 'door',
      x: 200 - 48,
      y: LEFT_WALL_Y - 12,
      width: 96,
      height: 24,
    };
    const lines = fenceSegments([room({ rotation: 90 }), door]);
    expect(fenceStep({ x: 200, y: -20 }, { x: 200, y: -70 }, lines).blocked).toBe(false);
  });

  it('turns a Room Builder room by its rotation too', () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const walls = roomWalls({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      roomOutline: outline,
      rotation: 180,
    });
    // Half a turn about (100, 50) swaps the top edge to the bottom.
    expect(walls[0]!.a.x).toBeCloseTo(200);
    expect(walls[0]!.a.y).toBeCloseTo(100);
  });
});
