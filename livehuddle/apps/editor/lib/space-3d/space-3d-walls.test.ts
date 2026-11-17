import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@livehuddle/templates';
import type { Element } from '@livehuddle/document';
import {
  SPACE_DOOR_HEIGHT,
  SPACE_FENCE_HEIGHT,
  SPACE_WALL_HEIGHT,
  spaceWalls,
  wallFrame,
  type SpaceWall,
} from './space-3d-walls';

const office = buildTemplate('virtual-office', 0, 0);
type Shape = Extract<Element, { type: 'shape' }>;
const shapes = office.filter((el): el is Shape => el.type === 'shape');
const length = (w: SpaceWall) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
const near = (w: SpaceWall, p: { x: number; y: number }, r: number) =>
  // The nearest point of the wall to p, within r.
  (() => {
    const dx = w.b.x - w.a.x;
    const dy = w.b.y - w.a.y;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / (dx * dx + dy * dy)),
    );
    return Math.hypot(w.a.x + t * dx - p.x, w.a.y + t * dy - p.y) <= r;
  })();

describe('the 3D view walls (docs/specs/008-canvas/3d-view.md "What it shows")', () => {
  it("stands up every Room's walls on a Virtual Office, each at a person's height, with its name on its back wall", () => {
    const walls = spaceWalls(office);
    const rooms = shapes.filter((el) => el.shape === 'room');
    expect(rooms.length).toBeGreaterThan(0);
    for (const room of rooms) {
      const own = walls.filter((w) => w.id.startsWith(`${room.id}:`));
      expect(own.length).toBeGreaterThan(3);
      for (const w of own) expect(w.height).toBe(SPACE_WALL_HEIGHT);
      if (room.label?.trim()) {
        const labelled = own.filter((w) => w.label);
        expect(labelled).toHaveLength(1);
        expect(labelled[0]!.label).toBe(room.label.trim());
        // The back wall: no level wall of the room is higher up.
        const top = Math.min(...own.filter((w) => w.a.y === w.b.y).map((w) => w.a.y));
        expect(labelled[0]!.a.y).toBe(top);
      }
    }
  });

  it('leaves a gap where each door stands, so you walk through it', () => {
    const walls = spaceWalls(office);
    const doors = shapes.filter((el) => el.shape === 'door' && !el.doorClosed);
    expect(doors.length).toBeGreaterThan(0);
    for (const door of doors) {
      const middle = { x: door.x + door.width / 2, y: door.y + door.height / 2 };
      expect(walls.some((w) => w.kind !== 'door' && near(w, middle, 2))).toBe(false);
    }
  });

  it('closes a shut door with a door-height panel', () => {
    const shutOffice = office.map((el) =>
      el.type === 'shape' && el.shape === 'door' ? { ...el, doorClosed: true } : el,
    );
    const panels = spaceWalls(shutOffice).filter((w) => w.kind === 'door');
    expect(panels.length).toBe(shapes.filter((el) => el.shape === 'door').length);
    for (const p of panels) expect(p.height).toBe(SPACE_DOOR_HEIGHT);
  });

  it('orders each wall left to right (top to bottom when upright), and shades walls running away from you', () => {
    for (const w of spaceWalls(office)) {
      expect(w.a.x < w.b.x || (w.a.x === w.b.x && w.a.y < w.b.y)).toBe(true);
      expect(length(w)).toBeGreaterThan(0.5);
      expect(w.shade).toBeCloseTo(Math.abs(w.b.y - w.a.y) / length(w), 9);
    }
  });

  it('makes a glass room glass and a fence a low fence', () => {
    const [room] = shapes.filter((el) => el.shape === 'room');
    const glass = spaceWalls([{ ...room!, variant: 'glass' }]);
    expect(glass.length).toBeGreaterThan(0);
    expect(glass.every((w) => w.kind === 'glass')).toBe(true);
    const fence = spaceWalls([{ ...room!, id: 'f', shape: 'fence', width: 200, height: 12 }]);
    expect(fence).toHaveLength(1);
    expect(fence[0]!.kind).toBe('fence');
    expect(fence[0]!.height).toBe(SPACE_FENCE_HEIGHT);
  });

  it('stands up corridors and office pods as full walls, and a shut door only where it closes a wall', () => {
    const [room] = shapes.filter((el) => el.shape === 'room');
    const corridor = spaceWalls([
      { ...room!, id: 'c', shape: 'corridor', label: '', width: 400, height: 80 },
    ]);
    expect(corridor.length).toBeGreaterThan(0);
    expect(corridor.every((w) => w.kind === 'wall' && w.id.startsWith('c:') && !w.label)).toBe(
      true,
    );
    const pod = spaceWalls([{ ...room!, id: 'p', shape: 'office-pod', width: 160, height: 160 }]);
    expect(pod.length).toBeGreaterThan(0);
    expect(pod.every((w) => w.kind === 'wall')).toBe(true);
    // A shut door in the open, on no wall, draws nothing.
    const [door] = shapes.filter((el) => el.shape === 'door');
    const lone = spaceWalls([{ ...door!, x: 90000, y: 90000, doorClosed: true }]);
    expect(lone).toEqual([]);
  });

  it('draws nothing for a board with no walls', () => {
    expect(spaceWalls([])).toEqual([]);
    expect(spaceWalls(office.filter((el) => el.type !== 'shape'))).toEqual([]);
  });

  it('places a wall by its start, length and angle', () => {
    const wall: SpaceWall = {
      id: 'w',
      a: { x: 10, y: 20 },
      b: { x: 10, y: 120 },
      kind: 'wall',
      height: 60,
      shade: 1,
    };
    expect(wallFrame(wall)).toEqual({ x: 10, y: 20, length: 100, angle: 90 });
  });
});
