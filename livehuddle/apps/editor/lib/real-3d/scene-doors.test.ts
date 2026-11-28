// Doors in Real 3D (docs/specs/008-canvas/3d-view.md "Doorways", room-builder.md "Opening on their own"): each type
// its own parts, and a door that opens while someone is near and shuts behind them.
import { describe, expect, it } from 'vitest';
import type { SpaceWall } from '@/lib/space-3d/space-3d-walls';
import {
  DOOR_CLOSE_DELAY_MS,
  DOOR_CLOSE_MS,
  DOOR_OPEN_MS,
  DOOR_OPEN_REACH,
  doorEase,
  doorParts,
  SHUT_DOOR,
  someoneNear,
  stepDoor,
  type DoorState,
} from './scene-doors';
import { wallMesh, wallPalette, WALL_CUT_HEIGHT } from './scene-walls';

const palette = wallPalette(() => '');
const doorway = (extra: Partial<SpaceWall> = {}): SpaceWall => ({
  id: 'door:0',
  a: { x: 100, y: 0 },
  b: { x: 196, y: 0 },
  kind: 'doorway',
  height: 152,
  shade: 0,
  doorId: 'd',
  hinge: 'start',
  ...extra,
});

describe('doorParts: each type looks its own', () => {
  const moves = (w: SpaceWall) =>
    doorParts(w, palette).map((p) => `${p.move}:${Math.sign(p.open)}`);

  it('stands a plain Door as one leaf swinging from its hinge to the arc side', () => {
    expect(moves(doorway())).toEqual(['swing:1']);
    expect(doorParts(doorway(), palette)[0]?.pivot).toEqual({ x: 104, y: 0 });
    // Hinged at the far jamb it swings the other way round, to the same side.
    const end = doorParts(doorway({ hinge: 'end' }), palette);
    expect(end.map((p) => p.pivot)).toEqual([{ x: 192, y: 0 }]);
    expect(end[0]!.open).toBeLessThan(0);
  });

  it('stands a Double Door as two leaves swinging apart, a Sliding Door as two panels sliding into the wall', () => {
    const double = doorParts(doorway({ variant: 'double', b: { x: 244, y: 0 } }), palette);
    expect(double.map((p) => p.move)).toEqual(['swing', 'swing']);
    expect(double.map((p) => Math.sign(p.open))).toEqual([1, -1]);
    const sliding = doorParts(doorway({ variant: 'sliding', b: { x: 220, y: 0 } }), palette);
    expect(sliding.map((p) => p.move)).toEqual(['fixed', 'slide', 'slide']);
    // Each panel slides most of its own width away from the middle.
    expect(sliding[1]!.open).toBeLessThan(-50);
    expect(sliding[2]!.open).toBeGreaterThan(50);
  });

  it('stands a Revolving Door as a fixed drum and turning wings about its middle', () => {
    const rev = doorParts(doorway({ variant: 'revolving' }), palette);
    expect(rev.map((p) => p.move)).toEqual(['fixed', 'spin']);
    expect(rev[1]!.pivot).toEqual({ x: 148, y: 0 });
    // The drum's glass, the wings' glass.
    for (const p of rev) expect(p.builder.glassPositions.length).toBeGreaterThan(0);
  });

  it('draws the four types differently, an unknown type as the plain Door, and glass doors in a glass wall', () => {
    const geometry = (w: SpaceWall) =>
      doorParts(w, palette)
        .map((p) => p.builder.positions.length + p.builder.glassPositions.length)
        .join(',');
    const looks = ['swing', 'double', 'sliding', 'revolving'].map((variant) =>
      geometry(doorway({ variant })),
    );
    expect(new Set(looks).size).toBe(4);
    expect(geometry(doorway({ variant: 'trapdoor' }))).toBe(looks[0]);
    const wood = doorParts(doorway(), palette)[0]!.builder;
    const glass = doorParts(doorway({ glass: true }), palette)[0]!.builder;
    expect(wood.glassPositions).toHaveLength(0);
    expect(glass.glassPositions.length).toBeGreaterThan(0);
  });

  it('is cut down with its wall, and leaves the wall itself only the frame and lintel', () => {
    for (const p of doorParts(doorway({ variant: 'double' }), palette, WALL_CUT_HEIGHT)) {
      const z = p.builder.positions.filter((_, i) => i % 3 === 2);
      expect(Math.max(...z)).toBeLessThanOrEqual(WALL_CUT_HEIGHT);
    }
    expect(doorParts({ ...doorway(), kind: 'wall' }, palette)).toEqual([]);
    // The wall's own mesh no longer bakes a leaf in: the same blocks whatever the door's type.
    const frame = (variant?: string) => wallMesh(doorway({ variant }), palette).positions.length;
    expect(frame('sliding')).toBe(frame());
  });
});

describe('a door opens as someone comes and shuts behind them', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 96, y: 0 };

  it('counts feet within DOOR_OPEN_REACH of its opening, on either side', () => {
    expect(someoneNear(a, b, [{ x: 48, y: DOOR_OPEN_REACH }])).toBe(true);
    expect(someoneNear(a, b, [{ x: 48, y: -DOOR_OPEN_REACH }])).toBe(true);
    expect(someoneNear(a, b, [{ x: 48, y: DOOR_OPEN_REACH + 1 }])).toBe(false);
    expect(someoneNear(a, b, [{ x: 96 + DOOR_OPEN_REACH + 1, y: 0 }])).toBe(false);
    expect(someoneNear(a, b, [])).toBe(false);
  });

  it('opens over DOOR_OPEN_MS, holds while someone stays, then shuts over DOOR_CLOSE_MS after the delay', () => {
    let s: DoorState = SHUT_DOOR;
    let now = 1000;
    const run = (near: boolean, ms: number) => {
      for (let t = 0; t < ms; t += 16) {
        now += 16;
        s = stepDoor(s, near, now, 16);
      }
    };
    run(true, DOOR_OPEN_MS / 2);
    expect(s.open).toBeGreaterThan(0.3);
    expect(s.open).toBeLessThan(0.7);
    run(true, DOOR_OPEN_MS);
    expect(s.open).toBe(1);
    // Nobody near: it waits, then shuts.
    run(false, DOOR_CLOSE_DELAY_MS - 50);
    expect(s.open).toBe(1);
    run(false, 100 + DOOR_CLOSE_MS);
    expect(s.open).toBe(0);
  });

  it('turns a revolving door while open and brings it to rest squared, never backwards', () => {
    let s: DoorState = SHUT_DOOR;
    let now = 0;
    for (let i = 0; i < 40; i++) s = stepDoor(s, true, (now += 16), 16);
    const turned = s.spin;
    expect(turned).toBeGreaterThan(0);
    for (let i = 0; i < 400; i++) s = stepDoor(s, false, (now += 16), 16);
    expect(s.spin).toBeGreaterThanOrEqual(turned);
    expect((s.spin / (Math.PI / 2)) % 1).toBeCloseTo(0, 6);
  });

  it('jumps under reduced motion, and hands back the same state when nothing moves', () => {
    const open = stepDoor(SHUT_DOOR, true, 10, 16, true);
    expect(open).toMatchObject({ open: 1, spin: Math.PI / 4 });
    const shut = stepDoor(open, false, 10 + DOOR_CLOSE_DELAY_MS, 16, true);
    expect(shut).toMatchObject({ open: 0, spin: 0 });
    expect(stepDoor(SHUT_DOOR, false, 10, 16)).toBe(SHUT_DOOR);
    expect(doorEase(0)).toBe(0);
    expect(doorEase(1)).toBe(1);
  });
});
