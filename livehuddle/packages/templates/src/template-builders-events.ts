// The Training Room (docs/specs/012-collaboration/virtual-office-template.md "Spaces"): an Events Space, the All-Hands
// Hall's smaller sibling for a course or a hands-on session: a small Stage up front with Bring Focus beside it, and
// four tables to work round in groups. Built from the office pieces with spacePlan (template-office-parts.ts).
//
// Pure: takes a centre (cx, cy) and returns a fresh Element[], floors first.

import { createShape, type Element } from '@livehuddle/document';
import {
  SPACE_BELOW,
  SPACE_HEAD,
  spacePlan,
  wayIn,
  type OfficeRoom,
} from './template-office-parts';

const ROOM_W = 1100;
const ROOM_H = 800;
// The stage at its own size, centred across the room.
const STAGE_W = 360;
const STAGE_X = (ROOM_W - STAGE_W) / 2;

export function buildTrainingRoom(cx: number, cy: number): Element[] {
  const width = ROOM_W;
  const height = SPACE_HEAD + ROOM_H + SPACE_BELOW;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const rooms: OfficeRoom[] = [
    {
      name: 'Training Room',
      x: 0,
      y: 0,
      w: ROOM_W,
      h: ROOM_H,
      door: 's',
      pieces: [
        { kind: 'stage', x: STAGE_X, y: 40, stageCameras: true },
        // The trainer's podium on it (docs/specs/009-elements/venue-pieces.md "In the templates").
        { kind: 'podium', x: STAGE_X + 270, y: 62 },
        // Four tables for group work, two each side of the aisle up from the doorway, an aisle between the rows
        // (docs/specs/007-editor/templates-by-mode.md "Every Space is roomy").
        { kind: 'meeting-table', x: 100, y: 240 },
        { kind: 'meeting-table', x: 768, y: 240 },
        { kind: 'meeting-table', x: 100, y: 528 },
        { kind: 'meeting-table', x: 768, y: 528 },
        { kind: 'coffee-machine', x: 40, y: 48 },
        { kind: 'water-cooler', x: 130, y: 40 },
        { kind: 'plant', x: 920, y: 60 },
        { kind: 'plant', x: 1020, y: 60 },
      ],
    },
  ];
  // The trainer's Bring Focus, beside the stage.
  const focus: Element = createShape('focus-button', x0 + 760, y0 + SPACE_HEAD + 60);
  return spacePlan(
    x0,
    y0,
    width,
    rooms,
    {
      text: 'Training Room',
      width: 300,
      sticker: 'emoji-microphone',
      subtitle:
        'Teach from the stage, then work it through round the tables. Bring Focus brings everyone back.',
    },
    [
      focus,
      ...wayIn(
        x0 + width,
        y0 + SPACE_HEAD + ROOM_H,
        'You arrive on the Avatar Pad: join a table. Whoever stands on the stage is heard by the whole room.',
      ),
    ],
  );
}
