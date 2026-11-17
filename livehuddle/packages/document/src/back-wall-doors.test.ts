// A Door on a rectangular Room's back wall (docs/specs/009-elements/room-builder.md "On a back wall", Work Tracker
// 1042): the room breaks its tall band at an open one and draws a shut one in its face; on the other three walls the
// Door's own gap opens the wall as before. The drawing both renderers paint, checked as drawn: the room's parts, the
// glass room's art and the exported SVG, open and shut, on each of the four walls.
import { describe, expect, it } from 'vitest';
import { ROOM_BACK_FACE, ROOM_WALL } from '@livehuddle/avatar/office-geometry';
import {
  backWallDoorLeaf,
  backWallDoors,
  backWallRuns,
  doorJamb,
  NO_BACK_WALL_DOORS,
} from './back-wall-doors';
import { roomParts } from './office';
import { glassRoomArt } from './glass-walls';
import { createShape } from './shape-factory';
import { snapDoorToWall } from './room-builder';
import { renderElementsToSvg } from './svg-render';
import type { Element, ShapeElement } from './index';

const ROOM: ShapeElement = {
  ...createShape('room', 0, 0),
  id: 'room',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  roomDoor: 'none',
};
type Side = 'n' | 'e' | 's' | 'w';
// A Door dropped near the middle of one wall and snapped onto it, as the editor does.
function doorOn(side: Side, closed = false, room: ShapeElement = ROOM): ShapeElement {
  const base = { ...createShape('door', 0, 0), id: `door-${side}` };
  const at = {
    n: { x: room.x + 150, y: room.y + ROOM_BACK_FACE - ROOM_WALL / 2 },
    s: { x: room.x + 150, y: room.y + room.height - ROOM_WALL / 2 },
    w: { x: room.x + ROOM_WALL / 2, y: room.y + 150 },
    e: { x: room.x + room.width - ROOM_WALL / 2, y: room.y + 150 },
  }[side];
  const free = { ...base, x: at.x - base.width / 2, y: at.y - base.height / 2 };
  const snapped = snapDoorToWall(free, [room]);
  return closed ? { ...snapped, doorClosed: true } : snapped;
}
const faces = (els: Element[]) =>
  roomParts(400, 300, 'none', backWallDoors(els).rooms.get('room')).filter(
    (p) => p.tag === 'rect' && p.role === 'face',
  );

describe('backWallDoors', () => {
  it('finds a Door on the back wall, its span along it and whether it is shut', () => {
    const open = doorOn('n');
    const found = backWallDoors([ROOM, open]);
    expect(found.doors.has(open.id)).toBe(true);
    const [span] = found.rooms.get('room')!;
    expect(span!.to - span!.from).toBe(open.width);
    expect(span!.closed).toBe(false);
    expect(backWallDoors([ROOM, doorOn('n', true)]).rooms.get('room')![0]!.closed).toBe(true);
  });

  it.each(['e', 's', 'w'] as const)(
    'leaves a Door on the %s wall to cut its wall itself',
    (side) => {
      const found = backWallDoors([ROOM, doorOn(side)]);
      expect(found).toBe(NO_BACK_WALL_DOORS);
    },
  );

  it('has none for a Room Builder room, whose walls are all one thickness', () => {
    const outlined: ShapeElement = {
      ...ROOM,
      roomOutline: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
    };
    expect(backWallDoors([outlined, doorOn('n')])).toBe(NO_BACK_WALL_DOORS);
  });

  it('ignores what is not a shape, a Door turned across the wall line and one past its ends', () => {
    const across = { ...doorOn('n'), id: 'across', rotation: 90 };
    const beyond = { ...doorOn('n'), id: 'beyond', x: 500 };
    const text = { ...createShape('room', 0, 0), type: 'text' } as unknown as Element;
    expect(backWallDoors([text, ROOM, across, beyond])).toBe(NO_BACK_WALL_DOORS);
  });

  it('is worked out once per board', () => {
    const els = [ROOM, doorOn('n')];
    expect(backWallDoors(els)).toBe(backWallDoors(els));
  });

  it('keeps each room its own doors, left to right', () => {
    const other: ShapeElement = { ...ROOM, id: 'other', x: 600 };
    const left = { ...doorOn('n'), id: 'left', x: 20 };
    const right = { ...doorOn('n'), id: 'right', x: 260 };
    const there = { ...doorOn('n', false, other), id: 'there' };
    const found = backWallDoors([ROOM, other, right, left, there]);
    expect(found.rooms.get('room')!.map((d) => d.from)).toEqual([20, 260]);
    expect(found.rooms.get('other')).toHaveLength(1);
  });
});

describe('the back wall, drawn', () => {
  it('runs whole with no doorway, and breaks at an open door and the built-in one', () => {
    expect(backWallRuns(400, [])).toEqual([[0, 400]]);
    expect(
      backWallRuns(
        400,
        [
          { from: 100, to: 196, closed: false },
          { from: 250, to: 300, closed: true },
        ],
        [40, 80],
      ),
    ).toEqual([
      [0, 40],
      [80, 100],
      [196, 400],
    ]);
    // A doorway from the wall's start leaves no run before it, one running to its end none after.
    expect(backWallRuns(400, [{ from: 0, to: 96, closed: false }])).toEqual([[96, 400]]);
    expect(backWallRuns(400, [{ from: 300, to: 400, closed: false }])).toEqual([[0, 300]]);
  });

  it('breaks the band from its top to the floor where an open Door stands', () => {
    const door = doorOn('n');
    const runs = faces([ROOM, door]).map((f) => (f.tag === 'rect' ? [f.x, f.x + f.w] : []));
    expect(runs).toEqual([
      [0, door.x],
      [door.x + door.width, 400],
    ]);
    // The band's top breaks with it, and nothing of the room crosses the doorway above the floor.
    const tops = roomParts(400, 300, 'none', backWallDoors([ROOM, door]).rooms.get('room')).filter(
      (p) => p.tag === 'rect' && p.role === 'panel' && p.y === 0 && p.h === ROOM_WALL,
    );
    expect(tops).toHaveLength(2);
  });

  it('keeps the band whole and stands a shut Door in its face, dyed, with a knob', () => {
    const door = doorOn('n', true);
    expect(faces([ROOM, door])).toHaveLength(1);
    const parts = roomParts(400, 300, 'none', backWallDoors([ROOM, door]).rooms.get('room'));
    const jamb = doorJamb(door.width);
    const dye = parts.find((p) => p.tag === 'rect' && p.role === 'dye');
    expect(dye).toMatchObject({ x: door.x + jamb, w: door.width - 2 * jamb, y: ROOM_WALL + 2 });
    expect(dye!.tag === 'rect' && dye!.y + dye!.h).toBe(ROOM_BACK_FACE - ROOM_WALL / 2);
    expect(parts.some((p) => p.tag === 'ellipse')).toBe(true);
  });

  it('places a shut leaf between its jambs, the knob on its leading side', () => {
    const { leaf, knob } = backWallDoorLeaf({ from: 100, to: 196, closed: true });
    expect(leaf).toEqual({
      x: 106,
      y: ROOM_WALL + 2,
      w: 84,
      h: ROOM_BACK_FACE - ROOM_WALL / 2 - ROOM_WALL - 2,
    });
    expect(knob.cx).toBeGreaterThan(leaf.x + leaf.w / 2);
    expect(knob.cx).toBeLessThan(leaf.x + leaf.w);
  });

  it('breaks a glass room’s face and pane at an open Door, and holds a shut one’s leaf', () => {
    const glass = { ...ROOM, variant: 'glass' };
    const open = glassRoomArt(
      glass,
      backWallDoors([glass, doorOn('n', false, glass)]).rooms.get('room'),
    );
    expect(open.faces).toHaveLength(2);
    expect(open.doors).toEqual([]);
    // The back wall's pane line stops either side of the doorway.
    const backLine = ROOM_BACK_FACE - ROOM_WALL / 2;
    expect(open.walls.match(new RegExp(` ${backLine}L`, 'g'))).toHaveLength(2);
    const shut = glassRoomArt(
      glass,
      backWallDoors([glass, doorOn('n', true, glass)]).rooms.get('room'),
    );
    expect(shut.faces).toHaveLength(1);
    expect(shut.doors).toHaveLength(1);
    expect(glassRoomArt(glass).doors).toEqual([]);
  });
});

// The export draws what the canvas does, open and shut on each of the four walls.
describe('exported, on each wall', () => {
  const svg = (side: Side, closed: boolean, room: ShapeElement = ROOM) =>
    renderElementsToSvg({ id: 't', name: 'T', elements: [room, doorOn(side, closed, room)] });
  const doorGroup = (out: string) => out.slice(out.lastIndexOf('<g transform="translate('));

  it('opens the back band at an open Door, the Door drawing only its leaf and arc', () => {
    const open = svg('n', false);
    const door = doorGroup(open);
    expect(door).toContain('stroke-dasharray="4 4"');
    // No gap or jambs of its own: the room drew the doorway.
    expect(door).not.toMatch(/<rect[^>]*height="13"/);
  });

  it('draws a shut Door on the back wall as the leaf in the face, and the Door nothing', () => {
    const shut = svg('n', true);
    expect(shut).toContain('opacity="0.7"');
    expect(doorGroup(shut)).toMatch(/<g transform="translate\([^)]*\)"><\/g>/);
  });

  it.each(['e', 's', 'w'] as const)(
    'cuts the %s wall with the Door’s own gap, open and shut',
    (side) => {
      const open = doorGroup(svg(side, false));
      const shut = doorGroup(svg(side, true));
      // Its gap in the floor's colour, a wall's thickness and a little more, both ways.
      for (const out of [open, shut]) expect(out).toMatch(/<rect[^>]*height="13" fill=/);
      expect(open).toContain('stroke-dasharray="4 4"');
      expect(shut).not.toContain('stroke-dasharray');
      expect(shut).toContain('rotate(-90');
    },
  );

  it('draws a glass room’s shut back-wall Door as a frosted leaf', () => {
    const glass = { ...ROOM, variant: 'glass' };
    expect(svg('n', true, glass)).toMatch(/<rect[^>]*rx="1.5"[^>]*fill-opacity="0.2"/);
  });
});
