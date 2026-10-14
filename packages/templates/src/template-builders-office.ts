// The Virtual Office template (docs/specs/012-collaboration/virtual-office-template.md): a whole office to walk
// round in Avatar mode, built from the office pieces (docs/specs/009-elements/office.md) and the furniture
// (docs/specs/009-elements/chair.md). A reception, a room of desks and a meeting room along the top of a corridor;
// a kitchen, a lounge and a quiet focus room along the bottom; every doorway onto the corridor, and a Walk In
// button at its end.
//
// Pure: takes a centre (cx, cy) and returns a fresh Element[], rooms first so they lie behind the furniture.

import {
  createShape,
  createText,
  type ChairFacing,
  type Element,
  type RoomDoor,
  type ShapeKind,
} from '@livediagram/document';
import { heading } from './template-session-parts';

// The office's footprint: two rows of rooms either side of a corridor.
const ROW_H = 340;
const CORRIDOR = 130;
const GAP = 60;
const HEAD = 96;
const WIDTH = 1560;
const HEIGHT = HEAD + ROW_H * 2 + CORRIDOR;

type Piece = { kind: ShapeKind; x: number; y: number; facing?: ChairFacing; label?: string };
type RoomSpec = { name: string; x: number; y: number; w: number; door: RoomDoor; pieces: Piece[] };

// Every room, its doorway onto the corridor, and what is in it, in room-relative px.
const ROOMS: RoomSpec[] = [
  {
    name: 'Reception',
    x: 0,
    y: 0,
    w: 420,
    door: 's',
    pieces: [
      { kind: 'rug', x: 110, y: 170 },
      { kind: 'sofa', x: 134, y: 52, facing: 'n' },
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
      { kind: 'desk', x: 30, y: 190, facing: 's' },
      { kind: 'desk', x: 180, y: 190, facing: 's' },
      { kind: 'desk', x: 330, y: 190, facing: 's' },
      { kind: 'plant', x: 530, y: 230 },
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
    w: 560,
    door: 'n',
    pieces: [
      { kind: 'rug', x: 180, y: 180 },
      { kind: 'bookshelf', x: 22, y: 40 },
      { kind: 'sofa', x: 204, y: 60, facing: 'n' },
      { kind: 'chair', x: 100, y: 196, facing: 'w' },
      { kind: 'chair', x: 400, y: 196, facing: 'e' },
      { kind: 'plant', x: 480, y: 52 },
    ],
  },
  {
    name: 'Focus Room',
    x: 520 + GAP + 560 + GAP,
    y: ROW_H + CORRIDOR,
    w: 420,
    door: 'n',
    pieces: [
      { kind: 'desk', x: 150, y: 120, facing: 's' },
      { kind: 'plant', x: 22, y: 230 },
      { kind: 'bookshelf', x: 280, y: 40 },
    ],
  },
];

export function buildVirtualOffice(cx: number, cy: number): Element[] {
  const x0 = cx - WIDTH / 2;
  const y0 = cy - HEIGHT / 2;
  const top = y0 + HEAD;
  const rooms: Element[] = [];
  const floor: Element[] = [];
  const furniture: Element[] = [];
  for (const room of ROOMS) {
    const rx = x0 + room.x;
    const ry = top + room.y;
    rooms.push({
      ...createShape('room', rx, ry),
      width: room.w,
      height: ROW_H,
      label: room.name,
      roomDoor: room.door,
    });
    for (const p of room.pieces) {
      const el: Element = {
        ...createShape(p.kind, rx + p.x, ry + p.y),
        ...(p.facing ? { chairFacing: p.facing } : {}),
        ...(p.label ? { label: p.label } : {}),
      };
      (p.kind === 'rug' ? floor : furniture).push(el);
    }
  }
  // At the corridor's end: the way in, and what to do once you are.
  const corridorY = top + ROW_H;
  const button: Element = {
    ...createShape('mode-button', x0 + WIDTH - 104 - 20, corridorY + (CORRIDOR - 96) / 2),
    label: 'Walk In',
  };
  const hint: Element = {
    ...createText(x0 + WIDTH - 104 - 40 - 520, corridorY + (CORRIDOR - 64) / 2),
    width: 520,
    height: 64,
    label:
      'Press Walk In (or W) to walk round. Enter says something, a chair or sofa seats you, and the coffee machine makes a coffee.',
    textSize: 'sm',
    textAlignX: 'right',
    textColor: '#475569',
  };
  return [
    ...rooms,
    ...floor,
    ...heading(
      x0,
      y0,
      WIDTH,
      'Our Office',
      210,
      'emoji-wave',
      'Walk in, find a desk, meet round the table and grab a coffee together. Rename the rooms to fit your team.',
    ),
    ...furniture,
    button,
    hint,
  ];
}
