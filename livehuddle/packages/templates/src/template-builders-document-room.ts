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

// The wall screen: 640 x 400 (the Screen's 8:5), centred on the back wall.
export const DOCUMENT_ROOM_SCREEN = { width: 640, height: 400 } as const;
const SCREEN_X = (ROOM_W - DOCUMENT_ROOM_SCREEN.width) / 2;

// Two rows of six chairs, three either side of a 160 px aisle up from the door, every sitter facing the screen. A row's
// 84 px and 120 px of floor between rows (templates-by-mode.md "Every Space is roomy").
const SEAT_XS = [194, 279, 364, 600, 685, 770];
const ROW_YS = [480, 684];

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
  { kind: 'coffee-machine', x: 40, y: 520 },
  { kind: 'water-cooler', x: 952, y: 500 },
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
    width,
    rooms,
    {
      text: 'Document Room',
      width: 320,
      sticker: 'emoji-desktop',
      subtitle:
        'Meet round one file: it is live on the big screen for everyone with access, and the chairs face it.',
    },
    // In the aisle behind the last row, the screen ahead.
    arrival({
      x: cx,
      y: y0 + SPACE_HEAD + 880,
      hintW: 200,
      hint: 'You arrive on the Avatar Pad: take a seat, and press the screen to open the file large.',
    }),
  );
}
