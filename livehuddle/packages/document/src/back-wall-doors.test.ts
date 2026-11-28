// A Door on a rectangular Room's back wall (docs/specs/009-elements/room-builder.md "On a back wall", Work Tracker
// 1042): the room breaks its tall band where one stands; on the other three walls the Door's own gap opens the wall as
// before. The drawing both renderers paint, checked as drawn: the room's parts, the glass room's art and the exported
// SVG, on each of the four walls.
import { describe, expect, it } from 'vitest';
import { ROOM_BACK_FACE, ROOM_WALL } from '@livehuddle/avatar/office-geometry';
import { backWallDoors, backWallRuns, NO_BACK_WALL_DOORS } from './back-wall-doors';
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
function doorOn(side: Side, room: ShapeElement = ROOM): ShapeElement {
  const base = { ...createShape('door', 0, 0), id: `door-${side}` };
  const at = {
    n: { x: room.x + 150, y: room.y + ROOM_BACK_FACE - ROOM_WALL / 2 },
    s: { x: room.x + 150, y: room.y + room.height - ROOM_WALL / 2 },
    w: { x: room.x + ROOM_WALL / 2, y: room.y + 150 },
    e: { x: room.x + room.width - ROOM_WALL / 2, y: room.y + 150 },
  }[side];
  const free = { ...base, x: at.x - base.width / 2, y: at.y - base.height / 2 };
  return snapDoorToWall(free, [room]);
}
const faces = (els: Element[]) =>
  roomParts(400, 300, 'none', backWallDoors(els).rooms.get('room')).filter(
    (p) => p.tag === 'rect' && p.role === 'face',
  );

describe('backWallDoors', () => {
  it('finds a Door on the back wall and its span along it', () => {
    const open = doorOn('n');
    const found = backWallDoors([ROOM, open]);
    expect(found.doors.has(open.id)).toBe(true);
    const [span] = found.rooms.get('room')!;
    expect(span!.to - span!.from).toBe(open.width);
    expect(span).toEqual({ from: span!.from, to: span!.to });
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
    const there = { ...doorOn('n', other), id: 'there' };
    const found = backWallDoors([ROOM, other, right, left, there]);
    expect(found.rooms.get('room')!.map((d) => d.from)).toEqual([20, 260]);
    expect(found.rooms.get('other')).toHaveLength(1);
  });
});

describe('the back wall, drawn', () => {
  it('runs whole with no doorway, and breaks at each door and the built-in one', () => {
    expect(backWallRuns(400, [])).toEqual([[0, 400]]);
    expect(
      backWallRuns(
        400,
        [
          { from: 100, to: 196 },
          { from: 250, to: 300 },
        ],
        [40, 80],
      ),
    ).toEqual([
      [0, 40],
      [80, 100],
      [196, 250],
      [300, 400],
    ]);
    // A doorway from the wall's start leaves no run before it, one running to its end none after.
    expect(backWallRuns(400, [{ from: 0, to: 96 }])).toEqual([[96, 400]]);
    expect(backWallRuns(400, [{ from: 300, to: 400 }])).toEqual([[0, 300]]);
  });

  it('breaks the band from its top to the floor where a Door stands', () => {
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

  it('breaks a glass room’s face and pane at a Door', () => {
    const glass = { ...ROOM, variant: 'glass' };
    const open = glassRoomArt(glass, backWallDoors([glass, doorOn('n', glass)]).rooms.get('room'));
    expect(open.faces).toHaveLength(2);
    // The back wall's pane line stops either side of the doorway.
    const backLine = ROOM_BACK_FACE - ROOM_WALL / 2;
    expect(open.walls.match(new RegExp(` ${backLine}L`, 'g'))).toHaveLength(2);
    expect(glassRoomArt(glass).faces).toHaveLength(1);
  });
});

// The export draws what the canvas does, on each of the four walls.
describe('exported, on each wall', () => {
  const svg = (side: Side, room: ShapeElement = ROOM) =>
    renderElementsToSvg({ id: 't', name: 'T', elements: [room, doorOn(side, room)] });
  const doorGroup = (out: string) => out.slice(out.lastIndexOf('<g transform="translate('));

  it('opens the back band at a Door, the Door drawing only its leaf and arc', () => {
    const door = doorGroup(svg('n'));
    expect(door).toContain('stroke-dasharray="4 4"');
    // No gap or jambs of its own: the room drew the doorway.
    expect(door).not.toMatch(/<rect[^>]*height="13"/);
  });

  it.each(['e', 's', 'w'] as const)('cuts the %s wall with the Door’s own gap', (side) => {
    const out = doorGroup(svg(side));
    // Its gap in the floor's colour, a wall's thickness and a little more, then its leaf and arc.
    expect(out).toMatch(/<rect[^>]*height="13" fill=/);
    expect(out).toContain('stroke-dasharray="4 4"');
  });
});
