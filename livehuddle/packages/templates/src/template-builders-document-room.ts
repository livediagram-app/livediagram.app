// The Document Room (docs/specs/012-collaboration/virtual-office-template.md "Document Room", Work Tracker 1427): one
// room built for meeting round one file, and the room a call about a file in another app opens in. A big Screen on the
// back wall shows the file live to everyone in the room with their own access
// (docs/specs/009-elements/screen-and-room-sign.md "A file on the Screen"), and two rows of chairs face it either side
// of an aisle up from the door. Built with spacePlan, as the Team Pod is.
//
// Pure apart from the Notice Board's pin time (template-notes.ts): it takes a centre (cx, cy) and returns a fresh
// Element[], floors first.

import type { Element } from '@livehuddle/document';
import { arrival } from './template-arrival';
import type { TemplateNote } from './template-notes';
import {
  SPACE_BELOW,
  SPACE_HEAD,
  spacePlan,
  type OfficePiece,
  type OfficeRoom,
} from './template-office-parts';

const ROOM_W = 1040;
const ROOM_H = 1040;

// The wall screen: 800 x 500 (the Screen's 8:5), centred on the back wall. It keeps its size as the room opens out
// (template-roomy.ts), so it fills most of the wall between the Notice Board and the Timer.
export const DOCUMENT_ROOM_SCREEN = { width: 800, height: 500 } as const;
const SCREEN_X = (ROOM_W - DOCUMENT_ROOM_SCREEN.width) / 2;

// Two rows of six chairs, three either side of a 160 px aisle up from the door, every sitter facing the screen. Drawn
// here before the room opens out; built, the front row stands 76 px from the screen with a 120 px aisle between the
// rows, so the room sits close to the wall and sitting can frame the Screen with you (avatar-mode.md "The camera").
const SEAT_XS = [194, 279, 364, 600, 685, 770];
const ROW_YS = [456, 624] as const;

// The board by the screen: how the room works.
const ROOM_NOTES: readonly TemplateNote[] = [
  {
    title: 'The file on the screen',
    text: 'It is live for everyone in the room who can open it. Press the screen to open it large, or in its own app.',
    color: 'yellow',
  },
  {
    title: 'Take a seat',
    text: 'Walk onto a chair to sit in it. Everyone in the room hears everyone, so talk as you would round a table.',
    color: 'blue',
  },
];

const ROOM_PIECES: OfficePiece[] = [
  { kind: 'notice-board', x: 16, y: 4, notes: ROOM_NOTES },
  { kind: 'screen', x: SCREEN_X, y: 4, w: DOCUMENT_ROOM_SCREEN.width },
  // A Timer beside the screen, to timebox the discussion (docs/specs/009-elements/timer-and-stopwatch.md).
  { kind: 'timer', x: 880, y: 40 },
  ...ROW_YS.flatMap((y) =>
    SEAT_XS.map((x) => ({ kind: 'chair' as const, x, y, facing: 's' as const })),
  ),
  { kind: 'coffee-machine', x: 12, y: 520, facing: 'w' },
  { kind: 'water-cooler', x: ROOM_W - 70, y: 500, facing: 'e' },
  { kind: 'plant', x: 40, y: 920 },
  { kind: 'plant', x: 944, y: 920 },
];

export function buildDocumentRoom(cx: number, cy: number): Element[] {
  const width = ROOM_W;
  const height = SPACE_HEAD + ROOM_H + SPACE_BELOW;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const rooms: OfficeRoom[] = [
    {
      name: 'Document Room',
      x: 0,
      y: 0,
      w: ROOM_W,
      h: ROOM_H,
      door: 's',
      windows: [
        { side: 'w', at: 760 },
        { side: 'e', at: 760 },
      ],
      pieces: ROOM_PIECES,
    },
  ];
  return spacePlan(
    x0,
    y0,
    rooms,
    // In the aisle just behind the last row, the screen ahead.
    arrival({
      x: cx,
      y: y0 + SPACE_HEAD + 780,
    }),
  );
}
