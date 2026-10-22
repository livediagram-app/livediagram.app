// The space templates (docs/specs/012-collaboration/virtual-office-template.md "Spaces"): a Coworking Space, a Team
// Pod and an All-Hands Hall, the Virtual Office's siblings, each a floor plan to walk round together in Avatar mode.
// Built from the office pieces with furnishRooms (template-office-parts.ts).
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import { createShape, createSticky, createText, type Element } from '@livedesign/document';
import { heading } from './template-session-parts';
import { officePlan, walkIn, type OfficePiece, type OfficeRoom } from './template-office-parts';

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
    { kind: 'desk', x: x + 140, y, facing: 'n' },
    { kind: 'desk', x, y: y + 112, facing: 's' },
    { kind: 'desk', x: x + 140, y: y + 112, facing: 's' },
  ];
}

// --- Coworking Space -----------------------------------------------------------

const COWORK_W = 1100;
const COWORK_H = 560;

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
        ...deskCluster(50, 56),
        ...deskCluster(380, 56),
        // The coffee bar.
        { kind: 'coffee-machine', x: 50, y: 390 },
        { kind: 'water-cooler', x: 140, y: 376 },
        { kind: 'plant', x: 220, y: 410 },
        // The lounge.
        { kind: 'rug', x: 420, y: 390 },
        { kind: 'sofa', x: 454, y: 310, facing: 'n' },
        { kind: 'chair', x: 330, y: 400, facing: 'w' },
        { kind: 'chair', x: 660, y: 400, facing: 'e' },
        { kind: 'plant', x: 740, y: 440 },
        { kind: 'bookshelf', x: 690, y: 46 },
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
      pieces: [{ kind: 'chair', x: 62, y: 90, facing: 's' }],
    },
    {
      name: 'Booth 2',
      x: 860,
      y: 300,
      w: 200,
      h: 220,
      door: 'w',
      pieces: [{ kind: 'chair', x: 62, y: 90, facing: 's' }],
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
    walkIn(
      x0 + width,
      y0 + HEAD + COWORK_H + BELOW / 2,
      'Press Walk In (or W) to come in. Sit at any desk, step into a booth for a call, and say hello with Enter.',
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
      // Under the pod, not the whole plan: the button is where the character lands, so it waits by the pod's door
      // rather than under the board, a long walk from the way in.
      ...walkIn(
        x0 + POD_W,
        y0 + HEAD + POD_H + BELOW / 2,
        'Press Walk In (or W), take a desk, and meet round the table for the stand-up.',
      ),
    ],
  );
}

// --- All-Hands Hall ----------------------------------------------------------------

const HALL_W = 1000;
const HALL_H = 730;
const SEAT_XS = [90, 175, 260, 345, 580, 665, 750, 835];
const ROW_YS = [290, 390, 490, 590];
// The stage: the rug at its own 5:3, centred across the hall.
const STAGE_W = 360;
const STAGE_H = 216;
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
        // The stage, and rows of chairs facing it either side of an aisle.
        { kind: 'rug', x: STAGE_X, y: 48, w: STAGE_W, h: STAGE_H },
        ...ROW_YS.flatMap((y) =>
          SEAT_XS.map((x) => ({ kind: 'chair' as const, x, y, facing: 's' as const })),
        ),
        { kind: 'plant', x: 24, y: 60 },
        { kind: 'plant', x: 920, y: 60 },
        { kind: 'water-cooler', x: 24, y: 540 },
      ],
    },
  ];
  const top = y0 + HEAD;
  const stage: Element[] = [
    {
      ...createText(x0 + STAGE_X, top + 48 + (STAGE_H - 40) / 2),
      width: STAGE_W,
      height: 40,
      label: 'Stage',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'center',
      // No ink of its own: the rug under it is drawn per half, pale on light and deep brown on dark.
    },
    // The presenter's Bring Focus, so the room looks where they point.
    {
      ...createShape('focus-button', x0 + 720, top + 70),
    },
  ];
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
      ...stage,
      ...walkIn(
        x0 + width,
        y0 + HEAD + HALL_H + BELOW / 2,
        'Press Walk In (or W) and take a seat. Raise a hand with the Avatar panel’s Behaviour › Wave, which everyone sees.',
      ),
    ],
  );
}
