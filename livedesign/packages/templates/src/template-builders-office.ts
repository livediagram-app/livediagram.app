// The Virtual Office template (docs/specs/012-collaboration/virtual-office-template.md): a whole office to walk
// round in Avatar mode, built from the office pieces (docs/specs/009-elements/office.md) and the furniture
// (docs/specs/009-elements/chair.md). A reception, a room of desks and a meeting room along the top of a corridor;
// a kitchen, a lounge and a quiet focus room along the bottom; every doorway onto the corridor, and a Walk In
// button at its end.
//
// Pure: takes a centre (cx, cy) and returns a fresh Element[], rooms first so they lie behind the furniture.

import type { Element } from '@livedesign/document';
import { heading } from './template-session-parts';
import { officePlan, walkIn, type OfficeRoom } from './template-office-parts';

// The office's footprint: two rows of rooms either side of a corridor.
const ROW_H = 340;
const CORRIDOR = 130;
const GAP = 60;
const HEAD = 96;
const WIDTH = 1560;
const HEIGHT = HEAD + ROW_H * 2 + CORRIDOR;

type RoomSpec = Omit<OfficeRoom, 'h'>;

// Every room, its doorway onto the corridor, and what is in it, in room-relative px.
const ROOMS: RoomSpec[] = [
  {
    name: 'Reception',
    x: 0,
    y: 0,
    w: 420,
    door: 's',
    pieces: [
      // The sofa on its rug at the back, clear of the doorway.
      { kind: 'rug', x: 110, y: 40 },
      { kind: 'sofa', x: 134, y: 58, facing: 'n' },
      { kind: 'plant', x: 22, y: 52 },
      { kind: 'plant', x: 342, y: 52 },
    ],
  },
  {
    name: 'Desks',
    x: 420 + GAP,
    y: 0,
    w: 620,
    door: 's',
    pieces: [
      { kind: 'desk', x: 30, y: 48, facing: 's' },
      { kind: 'desk', x: 180, y: 48, facing: 's' },
      { kind: 'desk', x: 330, y: 48, facing: 's' },
      { kind: 'bookshelf', x: 480, y: 40 },
      // The near row leaves the doorway's column (262..358) clear, so walking in never lands at a desk: two desks
      // side by side as a bench on the left, one on the right.
      { kind: 'desk', x: 20, y: 190, facing: 's' },
      { kind: 'desk', x: 140, y: 190, facing: 's' },
      { kind: 'desk', x: 400, y: 190, facing: 's' },
      { kind: 'plant', x: 540, y: 230 },
    ],
  },
  {
    name: 'Meeting Room',
    x: 420 + GAP + 620 + GAP,
    y: 0,
    w: 400,
    door: 's',
    pieces: [
      { kind: 'meeting-table', x: 84, y: 80 },
      { kind: 'plant', x: 22, y: 52 },
      { kind: 'plant', x: 322, y: 52 },
    ],
  },
  {
    name: 'Kitchen',
    x: 0,
    y: ROW_H + CORRIDOR,
    w: 520,
    door: 'n',
    pieces: [
      { kind: 'water-cooler', x: 30, y: 52 },
      { kind: 'coffee-machine', x: 110, y: 68 },
      { kind: 'plant', x: 440, y: 52 },
      { kind: 'chair', x: 170, y: 200, facing: 'w' },
      { kind: 'chair', x: 290, y: 200, facing: 'e' },
    ],
  },
  {
    name: 'Lounge',
    x: 520 + GAP,
    y: ROW_H + CORRIDOR,
    // 500 wide, so the bottom row is the top row's 1560.
    w: 500,
    door: 'n',
    pieces: [
      // The sofa on its rug, well inside: just behind the doorway it sat whoever walked in.
      { kind: 'rug', x: 150, y: 180 },
      { kind: 'bookshelf', x: 22, y: 40 },
      { kind: 'sofa', x: 174, y: 200, facing: 'n' },
      { kind: 'chair', x: 70, y: 196, facing: 'w' },
      { kind: 'chair', x: 354, y: 196, facing: 'e' },
      { kind: 'plant', x: 420, y: 52 },
    ],
  },
  {
    name: 'Focus Room',
    x: 520 + GAP + 500 + GAP,
    y: ROW_H + CORRIDOR,
    w: 420,
    door: 'n',
    pieces: [
      // Off the doorway's column, so walking in reaches the room before the desk.
      { kind: 'desk', x: 40, y: 120, facing: 's' },
      { kind: 'plant', x: 340, y: 230 },
      { kind: 'bookshelf', x: 280, y: 40 },
    ],
  },
];

export function buildVirtualOffice(cx: number, cy: number): Element[] {
  const x0 = cx - WIDTH / 2;
  const y0 = cy - HEIGHT / 2;
  const top = y0 + HEAD;
  return officePlan(
    ROOMS.map((r) => ({ ...r, h: ROW_H })),
    x0,
    y0,
    HEAD,
    heading(
      x0,
      y0,
      WIDTH,
      'Our Office',
      210,
      'emoji-wave',
      'Walk in, find a desk, meet round the table and grab a coffee together. Rename the rooms to fit your team.',
    ),
    [
      // At the corridor's end: the way in, and what to do once you are.
      ...walkIn(
        x0 + WIDTH - 20,
        top + ROW_H + CORRIDOR / 2,
        'Press Walk In (or W) to walk round. Enter says something, a chair or sofa seats you, and the coffee machine makes a coffee.',
      ),
    ],
  );
}
