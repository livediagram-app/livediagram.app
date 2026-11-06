// The space templates (docs/specs/012-collaboration/virtual-office-template.md "Spaces"): a Coworking Space, a Team
// Pod and an All-Hands Hall, the Virtual Office's siblings, each a floor plan to walk round together in Avatar mode.
// Built from the office pieces with furnishRooms (template-office-parts.ts).
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import { createShape, createSticky, createText, type Element } from '@livehuddle/document';
import { heading } from './template-session-parts';
import {
  officePlan,
  wayIn,
  wayInBeside,
  WAY_IN_PAD_W,
  type OfficePiece,
  type OfficeRoom,
} from './template-office-parts';

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
      ],
    },
    // Two phone booths along the right, for a call without the room. Their doors face the open floor: a door in a
    // booth's front wall opened onto a 40 px strip by the room's own wall, too narrow to walk.
    {
      name: 'Booth 1',
      x: 860,
      y: 40,
      w: 200,
      h: 220,
      door: 'w',
      pieces: [{ kind: 'chair', x: 100, y: 90, facing: 's' }],
    },
    {
      name: 'Booth 2',
      x: 860,
      y: 300,
      w: 200,
      h: 220,
      door: 'w',
      pieces: [{ kind: 'chair', x: 100, y: 90, facing: 's' }],
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
    wayIn(
      x0 + width,
      y0 + HEAD + COWORK_H,
      'You arrive on the Avatar Pad. Sit at any desk, step into a booth for a call, and say hello with Enter.',
    ),
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
      pieces: [
        ...deskCluster(50, 56),
        { kind: 'meeting-table', x: 440, y: 80 },
        { kind: 'coffee-machine', x: 50, y: 330 },
        { kind: 'plant', x: 140, y: 360 },
        { kind: 'bookshelf', x: 600, y: 300 },
      ],
    },
  ];
  // The team's board on the wall beside the pod: four stickies to fill in together.
  const bx = x0 + POD_W + BOARD_GAP;
  const by = y0 + HEAD;
  const boardBottom = by + 44 + 2 * 154 - 8;
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
      // Under the board, beside the pod (docs/specs/012-collaboration/virtual-office-template.md "Spaces"), not under
      // the plan: seen at 100% from a desk or the table, the pod's bottom edge lies along the canvas's bottom, where
      // the bottom-right cluster floats, and a way in under the pod sat under the cluster. Here the pad is level with
      // the pod's lower half, with open floor under it and a short walk round to the door.
      ...wayInBeside(
        x0 + width,
        (boardBottom + y0 + HEAD + POD_H) / 2,
        'You arrive on the Avatar Pad. Take a desk, and meet at the table for the stand-up.',
        BOARD_W - WAY_IN_PAD_W - 20,
      ),
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
      pieces: [
        // The stage, and rows of chairs facing it either side of an aisle. Whoever speaks from it is heard by the
        // whole hall, and seen: the hall exists for a presenter everyone watches.
        { kind: 'stage', x: STAGE_X, y: 48, w: STAGE_W, h: STAGE_H, stageCameras: true },
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
      ...wayIn(
        x0 + width,
        y0 + HEAD + HALL_H,
        'You arrive on the Avatar Pad: take a seat. Raise a hand with the Avatar panel’s Behaviour › Wave, which everyone sees.',
      ),
    ],
  );
}
