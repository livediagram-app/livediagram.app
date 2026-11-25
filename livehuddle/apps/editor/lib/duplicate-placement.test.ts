// Where a duplicate lands (docs/specs/008-canvas/canvas-and-palette.md "Duplicate", blueprint
// docs/specs/008-canvas/blueprints/duplicate-placement.md, Work Tracker 636).

import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { ROOM_BACK_FACE, ROOM_WALL } from '@livehuddle/avatar/office-geometry';
import {
  doorsFollowRooms,
  onRoomWall,
  rectsIntersect,
  snapDoorToWall,
  wallUnder,
  type Element,
  type RetiredArrowElement,
  type ShapeElement,
} from '@livehuddle/document';
import {
  DUPLICATE_GAP,
  DUPLICATE_SPOT_STEPS,
  duplicateOffset,
  duplicateWithWallPieces,
  isWalled,
  groupDuplicateOffset,
  placeDuplicate,
} from './duplicate-placement';

const piece = (
  id: string,
  x: number,
  y: number,
  width = 96,
  height = 144,
  shape = 'arcade-machine',
): ShapeElement => ({ id, type: 'shape', shape, x, y, width, height }) as ShapeElement;
// A Room as every new one is: no built-in doorway, its Doors are pieces (office.md "The doorway is a Door").
const room = (id: string, x: number, y: number, width = 480, height = 360): ShapeElement => ({
  ...piece(id, x, y, width, height, 'room'),
  roomDoor: 'none',
});
const door = (id: string, x: number, y: number, width = 96): ShapeElement =>
  piece(id, x, y, width, 24, 'door');
const copyOf = <T extends Element>(el: T): T => ({ ...el, id: `${el.id}-copy` });
const boxOf = (el: ShapeElement) => ({ x: el.x, y: el.y, width: el.width, height: el.height });

describe('placeDuplicate: a piece', () => {
  it('puts an Arcade Machine copy beside the original, clear of it, not 24 px over it', () => {
    const arcade = piece('a', 100, 100);
    const copy = placeDuplicate(arcade, copyOf(arcade), [arcade]);
    expect(copy).toMatchObject({ id: 'a-copy', x: 100 + 96 + DUPLICATE_GAP, y: 100 });
    expect(rectsIntersect(boxOf(copy), boxOf(arcade))).toBe(false);
  });

  it('goes below when the right is taken, then left, then above', () => {
    const arcade = piece('a', 0, 0);
    const right = piece('r', 96 + DUPLICATE_GAP, 0);
    expect(placeDuplicate(arcade, copyOf(arcade), [arcade, right])).toMatchObject({
      x: 0,
      y: 144 + DUPLICATE_GAP,
    });
    const below = piece('b', 0, 144 + DUPLICATE_GAP);
    expect(placeDuplicate(arcade, copyOf(arcade), [arcade, right, below])).toMatchObject({
      x: -(96 + DUPLICATE_GAP),
      y: 0,
    });
    const left = piece('l', -(96 + DUPLICATE_GAP), 0);
    expect(placeDuplicate(arcade, copyOf(arcade), [arcade, right, below, left])).toMatchObject({
      x: 0,
      y: -(144 + DUPLICATE_GAP),
    });
  });

  it('steps further out when the four nearest spots are all taken', () => {
    const arcade = piece('a', 0, 0);
    const ring = [piece('r', 120, 0), piece('b', 0, 168), piece('l', -120, 0), piece('t', 0, -168)];
    expect(placeDuplicate(arcade, copyOf(arcade), [arcade, ...ring])).toMatchObject({
      x: 240,
      y: 0,
    });
  });

  it('takes the right anyway when nothing nearby is free', () => {
    const arcade = piece('a', 0, 0);
    // Two patches of grass, each under part of the original but neither holding it wholly, block every spot tried.
    const blocker = piece('g', -1000, 10, 3000, 3000, 'grass');
    const above = piece('t', -1000, -2000, 3000, 2000, 'grass');
    const copy = placeDuplicate(arcade, copyOf(arcade), [arcade, blocker, above]);
    expect(copy).toMatchObject({ x: 96 + DUPLICATE_GAP, y: 0 });
  });

  it('never counts what the original stands inside (a floor, a zone) as in the way', () => {
    const arcade = piece('a', 100, 100);
    const grass = piece('g', 0, 0, 1000, 1000, 'grass');
    expect(placeDuplicate(arcade, copyOf(arcade), [grass, arcade])).toMatchObject({
      x: 100 + 96 + DUPLICATE_GAP,
      y: 100,
    });
  });

  it("keeps to its Room's floor when a free spot there exists, though a nearer one is off it", () => {
    const office = room('room', 0, 0, 480, 360);
    // Near the room's right wall: right of it would stand on the wall, so the copy goes left, on the floor.
    const arcade = piece('a', 480 - ROOM_WALL - 96 - 4, ROOM_BACK_FACE + 10);
    const copy = placeDuplicate(arcade, copyOf(arcade), [office, arcade]);
    expect(copy).toMatchObject({ x: arcade.x - 96 - DUPLICATE_GAP, y: arcade.y });
  });

  it('prefers the innermost container, whatever order the tab holds them in', () => {
    const office = room('room', 0, 0, 480, 360);
    const grass = piece('g', -1000, -1000, 3000, 3000, 'grass');
    const arcade = piece('a', 480 - ROOM_WALL - 96 - 4, ROOM_BACK_FACE + 10);
    const copy = placeDuplicate(arcade, copyOf(arcade), [office, grass, arcade]);
    expect(copy).toMatchObject({ x: arcade.x - 96 - DUPLICATE_GAP, y: arcade.y });
  });

  it('leaves the Room when its floor has no free spot', () => {
    const office = room('room', 0, 0, 140, 200);
    const arcade = piece('a', ROOM_WALL, ROOM_BACK_FACE);
    const copy = placeDuplicate(arcade, copyOf(arcade), [office, arcade]);
    expect(copy).toMatchObject({ x: arcade.x + 96 + DUPLICATE_GAP, y: arcade.y });
  });

  it('leaves a retired arrow as it is', () => {
    const arrow = {
      id: 'l',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 10, y: 0 },
    } as unknown as RetiredArrowElement;
    expect(placeDuplicate(arrow, copyOf(arrow), [arrow])).toEqual(copyOf(arrow));
  });
});

describe('placeDuplicate: a Room', () => {
  it("shares the original's wall instead of standing a gap away", () => {
    const office = room('room', 0, 0);
    const copy = placeDuplicate(office, copyOf(office), [office]);
    expect(copy).toMatchObject({ x: 480 - ROOM_WALL, y: 0 });
  });

  it('shares its front wall when the right is taken', () => {
    const office = room('room', 0, 0);
    const neighbour = room('n', 480 - ROOM_WALL, 0);
    const copy = placeDuplicate(office, copyOf(office), [office, neighbour]);
    expect(copy).toMatchObject({ x: 0, y: 360 - ROOM_BACK_FACE });
  });
});

describe('placeDuplicate: a Door or a Window', () => {
  // A Door on the room's front wall (the wall runs along y = 360 - ROOM_WALL / 2).
  const office = room('room', 0, 0);
  const wallY = 360 - ROOM_WALL / 2;
  const onFront = (id: string, cx: number) => door(id, cx - 48, wallY - 12);

  it('slides along the wall it stands on, snapped onto it, clear of the original', () => {
    const d = onFront('d', 200);
    const els = [office, d];
    const copy = placeDuplicate(d, copyOf(d), els);
    expect(wallUnder(copy, els)).not.toBeNull();
    expect(copy.y).toBeCloseTo(d.y);
    expect(Math.abs(copy.x - d.x)).toBeCloseTo(96 + DUPLICATE_GAP);
  });

  it('takes the other side when one side holds another Door', () => {
    const d = onFront('d', 200);
    const first = placeDuplicate(d, copyOf(d), [office, d]);
    const other = { ...first, id: 'other' };
    const copy = placeDuplicate(d, copyOf(d), [office, d, other]);
    expect(Math.sign(copy.x - d.x)).toBe(-Math.sign(other.x - d.x));
    expect(wallUnder(copy, [office, d, other])).not.toBeNull();
  });

  it('a Window slides the same way', () => {
    const w = { ...onFront('w', 200), shape: 'window' } as ShapeElement;
    const copy = placeDuplicate(w, copyOf(w), [office, w]);
    expect(wallUnder(copy, [office, w])).not.toBeNull();
    expect(Math.abs(copy.x - w.x)).toBeCloseTo(96 + DUPLICATE_GAP);
  });

  it('on a wall with no clear stretch, lands beside the original and snaps onto a wall in reach', () => {
    const small = room('small', 0, 0, 120, 120);
    const d = door('d', 12, 120 - ROOM_WALL / 2 - 12);
    const els = [small, d];
    const copy = placeDuplicate(d, copyOf(d), els);
    expect(copy.id).toBe('d-copy');
    expect(copy.x === d.x && copy.y === d.y).toBe(false);
  });

  it('a Door standing free lands beside it, and snaps onto a wall only when one is in reach', () => {
    const free = door('d', 2000, 2000);
    expect(placeDuplicate(free, copyOf(free), [office, free])).toMatchObject({
      x: 2000 + 96 + DUPLICATE_GAP,
      y: 2000,
    });
    // Standing just inside the front wall, beyond its reach of 48 px only once moved: the copy lands right of it and
    // snaps onto the wall.
    const near = door('n', 100, wallY - 12 - 40);
    const copy = placeDuplicate(near, copyOf(near), [office, near]);
    expect(wallUnder(copy, [office, near])).not.toBeNull();
  });
});

describe('groupDuplicateOffset', () => {
  it('moves a selection as one group beside its whole box', () => {
    const a = piece('a', 0, 0, 100, 100, 'plant');
    const b = piece('b', 200, 0, 100, 100, 'plant');
    expect(groupDuplicateOffset([a, b], new Set(['a', 'b']))).toEqual({
      dx: 300 + DUPLICATE_GAP,
      dy: 0,
    });
  });

  it('a selection of nothing on the tab steps the old diagonal', () => {
    expect(groupDuplicateOffset([], new Set(['x']))).toEqual({
      dx: DUPLICATE_GAP,
      dy: DUPLICATE_GAP,
    });
  });
});

describe('duplicateOffset budget', () => {
  // The worst case: a crowded floor where every spot the search tries is taken, so all of its tries scan the tab.
  it(`answers within budget on a tab of 5,000 pieces with all ${DUPLICATE_SPOT_STEPS * 4} spots taken`, () => {
    const els: Element[] = [];
    for (let i = 0; i < 5000; i++)
      els.push(piece(`p${i}`, (i % 70) * 100, Math.floor(i / 70) * 150, 90, 140));
    const source = els[2500] as ShapeElement;
    let d = { dx: 0, dy: 0 };
    const ms = cpuMsOf(() => {
      d = duplicateOffset(boxOf(source), els, new Set([source.id]));
    });
    expect(d.dx !== 0 || d.dy !== 0).toBe(true);
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });
});

// docs/specs/008-canvas/canvas-and-palette.md "Duplicate" (Work Tracker 1452): a Room or a Corridor brings the Doors
// and Windows on its walls, on the copy's same walls, never stacked on one already there.
describe('duplicateWithWallPieces', () => {
  const office = room('room', 0, 0);
  const snap = (el: ShapeElement, on: ShapeElement) => snapDoorToWall(el, [on]);
  // A Door in the middle of the front wall and a Window on the left wall, and a plant on the floor.
  const front = snap(door('front', 192, 360 - ROOM_WALL / 2 - 12), office);
  const win = snap({ ...piece('win', ROOM_WALL / 2 - 60, 150, 120, 24, 'window') }, office);
  const plant = piece('plant', 100, 100, 40, 40, 'plant');

  it("copies the Room with its Doors and Windows, each on the copy's same wall, under fresh ids", () => {
    const els = [office, front, win, plant];
    const copies = duplicateWithWallPieces(office, els) as ShapeElement[];
    expect(copies.map((c) => c.shape)).toEqual(['room', 'door', 'window']);
    const [copy, d, w] = copies;
    const dx = copy!.x - office.x;
    expect(dx).toBe(480 - ROOM_WALL);
    expect(d).toMatchObject({ x: front.x + dx, y: front.y });
    expect(d!.rotation ?? 0).toBe(front.rotation ?? 0);
    expect(w).toMatchObject({ x: win.x + dx, y: win.y, rotation: win.rotation });
    for (const c of copies) expect(els.some((e) => e.id === c.id)).toBe(false);
    expect(onRoomWall(d!, copy!)).toBe(true);
    expect(onRoomWall(w!, copy!)).toBe(true);
  });

  it('leaves out a copied Door that would stand on one already on the shared wall', () => {
    // Doors on the left and right walls at the same height: the copy (to the right) shares the original's right wall,
    // where the copy's left Door would land on the original's right one.
    const left = snap(door('left', ROOM_WALL / 2 - 48, 200), office);
    const right = snap(door('right', 480 - ROOM_WALL / 2 - 48, 200), office);
    const copies = duplicateWithWallPieces(office, [office, left, right]) as ShapeElement[];
    expect(copies).toHaveLength(2);
    const [copy, kept] = copies;
    expect(kept!.x).toBeCloseTo(right.x + copy!.x - office.x);
  });

  it('brings a Door standing on a wall the original shares with a neighbour', () => {
    const neighbour = room('n', 0, 360 - ROOM_BACK_FACE);
    // The original's front wall is the neighbour's back wall line: a Door there stands on both.
    const shared = snap(door('shared', 192, 360 - ROOM_WALL / 2 - 12), office);
    expect(onRoomWall(shared, neighbour)).toBe(true);
    const copies = duplicateWithWallPieces(office, [office, neighbour, shared]);
    expect(copies.map((c) => (c as ShapeElement).shape)).toEqual(['room', 'door']);
  });

  it('copies a Corridor with the Doors on its walls', () => {
    const corridor = piece('c', 0, 0, 480, 120, 'corridor');
    const d = snap(door('d', 192, -7), corridor);
    const copies = duplicateWithWallPieces(corridor, [corridor, d]) as ShapeElement[];
    expect(copies.map((c) => c.shape)).toEqual(['corridor', 'door']);
    expect(onRoomWall(copies[1]!, copies[0]!)).toBe(true);
  });

  it('copies a Room with no Doors on its own, and nothing for a Room not on the tab', () => {
    expect(duplicateWithWallPieces(office, [office, plant])).toHaveLength(1);
    expect(duplicateWithWallPieces(office, [plant])).toEqual([]);
    expect(isWalled(office)).toBe(true);
    expect(isWalled(plant)).toBe(false);
  });

  it("places a turned Room's copy a gap away, its Doors riding the same move", () => {
    const turned = { ...office, rotation: 45 };
    const d = snap(door('d', 192, 360 - ROOM_WALL / 2 - 12), office);
    // Put the Door on the turned room's wall by turning the board as the menu does.
    const [, onTurned] = doorsFollowRooms([office, d], [turned, d]) as ShapeElement[];
    const copies = duplicateWithWallPieces(turned, [turned, onTurned!]) as ShapeElement[];
    expect(copies[0]!.x - turned.x).toBe(480 + DUPLICATE_GAP);
    expect(onRoomWall(copies[1]!, copies[0]!)).toBe(true);
  });
});
