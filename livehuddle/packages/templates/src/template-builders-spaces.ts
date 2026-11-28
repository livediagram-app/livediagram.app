// The space templates (docs/specs/012-collaboration/virtual-office-template.md "Spaces"): a Coworking Space, a Team
// Pod and an All-Hands Hall, the Virtual Office's siblings, each a floor plan to walk round together in Avatar mode.
// Built from the office pieces with furnishRooms (template-office-parts.ts).
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import { arrival } from './template-arrival';
import type { TemplateNote } from './template-notes';
import { officePlan, type OfficePiece, type OfficeRoom } from './template-office-parts';

const HEAD = 96;
const BELOW = 120;

// A space's floor plan under its band (officePlan: floors first, then the rest).
function plan(x0: number, y0: number, rooms: OfficeRoom[], extra: Element[]): Element[] {
  return officePlan(rooms, x0, y0, HEAD, extra);
}

// Two desks facing two across a shared bench: the far pair's sitters face you, the near pair's face away.
function deskCluster(x: number, y: number): OfficePiece[] {
  return [
    { kind: 'desk', x, y, facing: 'n' },
    { kind: 'desk', x: x + 130, y, facing: 'n' },
    { kind: 'desk', x, y: y + 112, facing: 's' },
    { kind: 'desk', x: x + 130, y: y + 112, facing: 's' },
  ];
}

// --- Coworking Space -----------------------------------------------------------

const COWORK_W = 1500;

// The members' board, pinned when the Space is made (template-notes.ts): how the floor works.
const COWORK_NOTES: readonly TemplateNote[] = [
  {
    title: 'Welcome, members',
    text: 'Any desk is yours for the day. Walk up to someone to say hello, and their voice fades as you walk away.',
    color: 'yellow',
  },
  {
    title: 'Calls and meetings',
    text: 'Take a call in a booth: it is a call of its own and shows you as Busy. Meet in the Meeting Room, and knock on its sign if it is in use.',
    color: 'blue',
  },
  {
    title: 'Coffee bar',
    text: 'Walk up to the coffee machine for a coffee, and stay for a chat on the sofa.',
    color: 'green',
  },
];
const COWORK_H = 680;

export function buildCoworkingSpace(cx: number, cy: number): Element[] {
  const width = COWORK_W;
  const height = HEAD + COWORK_H + BELOW;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const rooms: OfficeRoom[] = [
    {
      name: 'Coworking',
      x: 0,
      y: 0,
      w: COWORK_W,
      h: COWORK_H,
      door: 's',
      // Windows along its outside walls, the back and the left (docs/specs/009-elements/room-builder.md "Window").
      windows: [
        { side: 'n', at: 300 },
        { side: 'n', at: 640 },
        { side: 'w', at: 200 },
        { side: 'w', at: 520 },
      ],
      pieces: [
        // Two clusters an aisle apart, the lounge an aisle below them.
        // Far enough off the back wall for a walk behind the far row's chairs (templates-by-mode.md "Made for 3D").
        ...deskCluster(50, 100),
        ...deskCluster(440, 100),
        // The coffee bar against the left wall, facing the floor.
        { kind: 'coffee-machine', x: 12, y: 380, facing: 'w' },
        { kind: 'water-cooler', x: 12, y: 470, facing: 'w' },
        { kind: 'plant', x: 160, y: 430 },
        // The lounge: the sofa on its rug, a chair either side of it.
        { kind: 'rug', x: 460, y: 470 },
        { kind: 'sofa', x: 484, y: 490, facing: 'n' },
        { kind: 'chair', x: 396, y: 490, facing: 'w' },
        { kind: 'chair', x: 648, y: 490, facing: 'e' },
        { kind: 'plant', x: 780, y: 580 },
        { kind: 'bookshelf', x: 720, y: 46 },
        // The members' lockers in the free corner under the booths, against the front wall
        // (docs/specs/009-elements/office-amenities.md).
        { kind: 'lockers', x: 900, y: 540, facing: 's' },
        // The members' Notice Board under the Meeting Room, its notes pinned already (template-notes.ts).
        { kind: 'notice-board', x: 1110, y: 520, notes: COWORK_NOTES },
        // The Meeting Room's sign, right of its door on the face of its front wall: inside the room's box, so it
        // reads the Meeting Room and not the Coworking floor around it (meetingPieceRoom takes the innermost room).
        { kind: 'room-sign', x: 1100 + 228 + 18, y: 40 + 360 - 50, w: 88 },
      ],
    },
    // Two phone booths along the right, for a call without the room, each a Phone Booth piece in a booth room
    // (docs/specs/009-elements/workday-pieces.md). Their doors face the open floor: a door in a booth's front wall
    // opened onto a 40 px strip by the room's own wall, too narrow to walk. Glass, so a free booth shows from the floor.
    {
      name: 'Booth 1',
      x: 860,
      y: 40,
      // A wall's width over the Meeting Room's, so the two share one wall (office.md "Rooms line up").
      w: 250,
      h: 220,
      door: 'w',
      glass: true,
      pieces: [{ kind: 'phone-booth', x: 90, y: 44 }],
    },
    {
      name: 'Booth 2',
      x: 860,
      // Under Booth 1, its back wall on Booth 1's front one.
      y: 40 + 220 - 36,
      w: 250,
      h: 256,
      door: 'w',
      glass: true,
      pieces: [{ kind: 'phone-booth', x: 90, y: 44 }],
    },
    // A glass Meeting Room on the right, a call of its own behind its walls and a Screen to share on, its door onto the
    // floor below it and a Room Sign beside the door to knock at (docs/specs/012-collaboration/knock.md).
    {
      name: 'Meeting Room',
      x: 1100,
      y: 40,
      w: 360,
      h: 360,
      door: 's',
      glass: true,
      pieces: [
        { kind: 'screen', x: 120, y: 4, w: 120 },
        { kind: 'meeting-table', x: 64, y: 96 },
        // The plant in the far corner, clear of the table, the front wall right of the door kept for the sign.
        { kind: 'plant', x: 296, y: 52 },
      ],
    },
  ];
  return plan(
    x0,
    y0,
    rooms,
    // On the open floor between the desks and the lounge, the coffee bar and the booths in view.
    arrival({
      x: cx - COWORK_W / 2 + 366,
      y: cy - 4,
    }),
  );
}

// --- Team Pod --------------------------------------------------------------------

const POD_W = 760;
const POD_H = 480;
// The strip beside the pod's right wall where the stand-up's Timer stood, until it moved inside the pod (QA,
// 2026-11-27: outside, the pod's wall hid half of it in 3D). It held the Team Board of four stickies too, until sticky
// notes left livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md "The Write category"); it keeps its width
// so the pod and its Avatar Pad sit where they did.
const BOARD_W = 300;
const BOARD_GAP = 40;

export function buildTeamPod(cx: number, cy: number): Element[] {
  const width = POD_W + BOARD_GAP + BOARD_W;
  const height = HEAD + POD_H + BELOW;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const rooms: OfficeRoom[] = [
    {
      name: 'Team Pod',
      x: 0,
      y: 0,
      w: POD_W,
      h: POD_H,
      door: 's',
      // Windows over the desks and the table, the back wall between them left for the Clock.
      windows: [
        { side: 'n', at: 150 },
        { side: 'n', at: 560 },
        { side: 'w', at: 260 },
      ],
      pieces: [
        ...deskCluster(50, 100),
        // The Clock on the back wall between the desks and the table, where everyone on the team sees it
        // (docs/specs/009-elements/social-pieces.md "Clock"), in the middle of the gap.
        { kind: 'world-clock', x: 338, y: 40 },
        { kind: 'meeting-table', x: 416, y: 80 },
        // A Phone Booth in the corner by the table, for a call away from the team: a call of its own, Busy while you
        // sit in it (docs/specs/009-elements/workday-pieces.md "Phone Booth").
        { kind: 'phone-booth', x: 666, y: 40 },
        { kind: 'coffee-machine', x: 12, y: 350, facing: 'w' },
        { kind: 'plant', x: 100, y: 390 },
        // Against the right wall, its back to it (docs/specs/009-elements/wall-pieces.md "Only on a wall").
        { kind: 'bookshelf', x: 700, y: 300 },
        // The team's dog (docs/specs/009-elements/workday-pieces.md "Pet Bed and its dog"), between the pad and the
        // table, right of the doorway's column.
        { kind: 'pet-bed', x: 470, y: 400 },
        // The stand-up's Timer inside the pod, on the floor between the table and the bookshelf, where the team
        // gathers: press it to timebox the round (docs/specs/009-elements/timer-and-stopwatch.md). It stood outside
        // the right wall, which hid half of it in 3D (QA, 2026-11-27).
        { kind: 'timer', x: 540, y: 250 },
      ],
    },
  ];
  return plan(x0, y0, rooms, [
    // In the middle of the pod, between the desks and the table.
    ...arrival({
      x: cx - 168,
      y: cy + 90,
    }),
  ]);
}

// --- All-Hands Hall ----------------------------------------------------------------

const HALL_W = 1000;
const HALL_H = 1100;
const SEAT_XS = [90, 175, 260, 345, 580, 665, 750, 835];
// A row's chairs side by side, an aisle (docs/specs/007-editor/templates-by-mode.md "Every Space is roomy") between
// rows: a chair's 84 px and 120 px of floor, so walking along a row to a seat never brushes the row in front.
const ROW_YS = [290, 494, 698, 902];
// The stage (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage's way in"): a real Stage, centred
// across the hall, its front edge well clear of the first row.
const STAGE_W = 400;
const STAGE_H = 160;
const STAGE_X = (HALL_W - STAGE_W) / 2;

export function buildAllHandsHall(cx: number, cy: number): Element[] {
  const width = HALL_W;
  const height = HEAD + HALL_H + BELOW;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const rooms: OfficeRoom[] = [
    {
      name: 'All-Hands',
      x: 0,
      y: 0,
      w: HALL_W,
      h: HALL_H,
      door: 's',
      // Windows down both long walls, between the rows.
      windows: [
        { side: 'w', at: 400 },
        { side: 'w', at: 800 },
        { side: 'e', at: 400 },
        { side: 'e', at: 800 },
      ],
      pieces: [
        // The stage, and rows of chairs facing it either side of an aisle. Whoever speaks from it is heard by the
        // whole hall, and seen: the hall exists for a presenter everyone watches.
        { kind: 'stage', x: STAGE_X, y: 48, w: STAGE_W, h: STAGE_H, stageCameras: true },
        // Its curtains framing it from the back wall, and the presenter's podium right of the middle
        // (docs/specs/009-elements/venue-pieces.md "In the templates").
        { kind: 'stage-curtains', x: STAGE_X - 10, y: 30, w: STAGE_W + 20 },
        { kind: 'podium', x: STAGE_X + 290, y: 82 },
        ...ROW_YS.flatMap((y) =>
          SEAT_XS.map((x) => ({ kind: 'chair' as const, x, y, facing: 's' as const })),
        ),
        { kind: 'plant', x: 24, y: 60 },
        { kind: 'plant', x: 920, y: 60 },
        { kind: 'water-cooler', x: 12, y: HALL_H - 340, facing: 'w' },
        // A Suggestion Box at the back for the Q&A: a question dropped in it is anonymous, and only Editors read it
        // (docs/specs/009-elements/team-pieces.md "Suggestion Box").
        { kind: 'suggestion-box', x: 24, y: HALL_H - 124 },
      ],
    },
  ];
  return plan(x0, y0, rooms, [
    // In the centre aisle, among the rows, facing the stage.
    ...arrival({
      x: cx,
      y: cy + 76,
    }),
  ]);
}
