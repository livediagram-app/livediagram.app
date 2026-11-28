// The Training Room (docs/specs/012-collaboration/virtual-office-template.md "Spaces"): an Events Space, the All-Hands
// Hall's smaller sibling for a course or a hands-on session: a small Stage up front, and
// four tables to work round in groups. Built from the office pieces with spacePlan (template-office-parts.ts).
//
// Pure: takes a centre (cx, cy) and returns a fresh Element[], floors first.

import { arrival } from './template-arrival';
import type { Element } from '@livehuddle/document';
import { SPACE_BELOW, SPACE_HEAD, spacePlan, type OfficeRoom } from './template-office-parts';
import { against, standAt } from './template-3d-place';

// Drawn at its final size for the 3D view (virtual-office-template.md "Laid out for the 3D view").
const ROOM_W = 1380;
const ROOM_H = 1000;
const ROOM = { w: ROOM_W, h: ROOM_H };
// The stage at its own size, centred across the room on the back wall.
const STAGE_W = 360;
const STAGE_X = (ROOM_W - STAGE_W) / 2;
// The four group tables, two either side of a centre aisle, their rows an aisle apart.
const TABLE_XS = [180, 968];
const TABLE_YS = [320, 620];

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
      // Windows down both side walls (docs/specs/009-elements/room-builder.md "Window").
      windows: [
        { side: 'w', at: 440 },
        { side: 'w', at: 780 },
        { side: 'e', at: 440 },
        { side: 'e', at: 780 },
      ],
      pieces: [
        { kind: 'stage', x: STAGE_X, y: 36, stageCameras: true },
        // The trainer's podium on it (docs/specs/009-elements/venue-pieces.md "In the templates").
        standAt('podium', STAGE_X + 290, 120),
        // Four tables for group work, two each side of the aisle up from the doorway
        // (docs/specs/007-editor/templates-by-mode.md "Every Space is roomy").
        ...TABLE_YS.flatMap((y) => TABLE_XS.map((x) => ({ kind: 'meeting-table' as const, x, y }))),
        // Coffee and water on the left wall by the stage, a plant in the corner.
        against('coffee-machine', 'w', 150, ROOM),
        against('water-cooler', 'w', 250, ROOM),
        against('plant', 'n', 60, ROOM),
        // A Timer to timebox the group work, beside the stage (docs/specs/009-elements/timer-and-stopwatch.md).
        { kind: 'timer', x: STAGE_X + STAGE_W + 90, y: 60 },
        against('plant', 'n', ROOM_W - 60, ROOM),
        // A Suggestion Box by the way out, for feedback on the session: anonymous, and only Editors read it
        // (docs/specs/009-elements/team-pieces.md "Suggestion Box").
        against('suggestion-box', 's', ROOM_W / 2 - 160, ROOM),
      ],
    },
  ];
  return spacePlan(x0, y0, rooms, [
    // In the aisle between the rows, the tables either side and the stage ahead.
    ...arrival({
      x: cx,
      y: y0 + SPACE_HEAD + 540,
    }),
  ]);
}
