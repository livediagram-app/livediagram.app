// The space templates (docs/specs/012-collaboration/virtual-office-template.md "Spaces"): a Coworking Space, a Team
// Pod and an All-Hands Hall, the Virtual Office's siblings, each a floor plan to walk round together in Avatar mode.
// Built from the office pieces with furnishRooms (template-office-parts.ts).
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import { createShape, createSticky, createText, type Element } from '@livehuddle/document';
import { heading } from './template-session-parts';
import { arrival } from './template-arrival';
import { officePlan, type OfficePiece, type OfficeRoom } from './template-office-parts';

const HEAD = 96;
const BELOW = 120;

// A space's floor plan with its heading (officePlan: floors first, then the heading, then the rest).
function plan(
  x0: number,
  y0: number,
  width: number,
  rooms: OfficeRoom[],
  title: string,
  titleW: number,
  sticker: string,
  subtitle: string,
  extra: Element[],
): Element[] {
  return officePlan(
    rooms,
    x0,
    y0,
    HEAD,
    heading(x0, y0, width, title, titleW, sticker, subtitle),
    extra,
  );
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

const COWORK_W = 1100;
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
        ...deskCluster(50, 56),
        ...deskCluster(440, 56),
        // The coffee bar.
        { kind: 'coffee-machine', x: 50, y: 390 },
        { kind: 'water-cooler', x: 140, y: 376 },
        { kind: 'plant', x: 220, y: 410 },
        // The lounge.
        { kind: 'rug', x: 420, y: 480 },
        { kind: 'sofa', x: 454, y: 400, facing: 'n' },
        { kind: 'chair', x: 330, y: 490, facing: 'w' },
        { kind: 'chair', x: 660, y: 490, facing: 'e' },
        { kind: 'plant', x: 760, y: 560 },
        { kind: 'bookshelf', x: 720, y: 46 },
        // The members' lockers in the free corner under the booths (docs/specs/009-elements/office-amenities.md).
        { kind: 'lockers', x: 900, y: 540 },
      ],
    },
    // Two phone booths along the right, for a call without the room, each a Phone Booth piece in a booth room
    // (docs/specs/009-elements/workday-pieces.md). Their doors face the open floor: a door in a booth's front wall
    // opened onto a 40 px strip by the room's own wall, too narrow to walk. Glass, so a free booth shows from the floor.
    {
      name: 'Booth 1',
      x: 860,
      y: 40,
      w: 200,
      h: 220,
      door: 'w',
      glass: true,
      pieces: [{ kind: 'phone-booth', x: 90, y: 44 }],
    },
    {
      name: 'Booth 2',
      x: 860,
      y: 300,
      w: 200,
      h: 220,
      door: 'w',
      glass: true,
      pieces: [{ kind: 'phone-booth', x: 90, y: 44 }],
    },
  ];
  return plan(
    x0,
    y0,
    width,
    rooms,
    'Coworking Space',
    360,
    'emoji-desktop',
    'Grab any desk, take calls in a booth, and meet at the coffee bar. Everyone is welcome to work here.',
    // On the open floor between the desks and the lounge, the coffee bar and the booths in view.
    arrival({
      x: cx - 184,
      y: cy - 4,
      hintW: 160,
      hint: 'You arrive on the Avatar Pad. Take any desk, or a booth for a call.',
    }),
  );
}

// --- Team Pod --------------------------------------------------------------------

const POD_W = 760;
const POD_H = 480;
const BOARD_W = 300;
const BOARD_GAP = 40;

const TEAM_BOARD = ['This week', 'Blocked on', 'Wins', 'Questions'];

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
      windows: [
        { side: 'n', at: 300 },
        { side: 'n', at: 560 },
        { side: 'w', at: 260 },
      ],
      pieces: [
        ...deskCluster(50, 56),
        { kind: 'meeting-table', x: 440, y: 80 },
        { kind: 'coffee-machine', x: 50, y: 330 },
        { kind: 'plant', x: 140, y: 360 },
        { kind: 'bookshelf', x: 600, y: 300 },
        // The team's dog (docs/specs/009-elements/workday-pieces.md "Pet Bed and its dog"), between the pad and the
        // table, right of the doorway's column.
        { kind: 'pet-bed', x: 456, y: 422 },
      ],
    },
  ];
  // The team's board on the wall beside the pod: four stickies to fill in together.
  const bx = x0 + POD_W + BOARD_GAP;
  const by = y0 + HEAD;
  const board: Element[] = [
    {
      ...createText(bx, by),
      width: BOARD_W,
      height: 32,
      label: 'Team Board',
      textSize: 'md',
      textBold: true,
    },
    ...TEAM_BOARD.map((label, i) => ({
      ...createSticky(bx + (i % 2) * 154, by + 44 + Math.floor(i / 2) * 154),
      width: 146,
      height: 146,
      label,
    })),
  ];
  return plan(
    x0,
    y0,
    width,
    rooms,
    'Team Pod',
    240,
    'emoji-handshake',
    'Your team’s corner: four desks together, a table for the stand-up, and a board for the week.',
    [
      ...board,
      // In the middle of the pod, between the desks and the table.
      ...arrival({
        x: cx - 168,
        y: cy + 52,
        hintW: 320,
        hint: 'You arrive on the Avatar Pad. Take a desk, and meet at the table for the stand-up.',
      }),
    ],
  );
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
        { kind: 'water-cooler', x: 24, y: HALL_H - 220 },
      ],
    },
  ];
  const top = y0 + HEAD;
  // The presenter's Bring Focus, so the room looks where they point. The stage names itself on its plate.
  const focus: Element = createShape('focus-button', x0 + 720, top + 70);
  return plan(
    x0,
    y0,
    width,
    rooms,
    'All-Hands Hall',
    320,
    'emoji-raised-hands',
    'Take a seat for the all-hands: the stage up front, the room facing it, and Bring Focus for the presenter.',
    [
      focus,
      // In the centre aisle, among the rows, facing the stage: the line under it is a narrow sign down the aisle.
      ...arrival({
        x: cx,
        y: cy + 76,
        hintW: 140,
        hint: 'You arrive on the Avatar Pad: take a seat, and Wave to raise a hand.',
      }),
    ],
  );
}
