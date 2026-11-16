// Two Events Spaces for learning and making together (docs/specs/012-collaboration/virtual-office-template.md
// "Classroom and Hackathon Hall", Work Tracker 1076): a Classroom with three breakout rooms to split into, and a
// Hackathon Hall with team tables on the floor, a demo stage, a mentor room, a nap room and a snack bar. Each is a
// building of closed rooms off an open floor, as the Games Rooms are (`campusPlan` with indoor rooms): every room has a
// Door, a Room Sign and 160 px of open floor in front of its Door, and a Directory stands by the entrance.
//
// Each builder is pure apart from the Notice Board's pin time (template-notes.ts): it takes a centre (cx, cy) and
// returns a fresh Element[], floors first.

import { createShape, type Element } from '@livehuddle/document';
import { campusPlan, type IndoorRoom } from './template-campus-parts';
import type { TemplateNote } from './template-notes';
import type { OfficePiece } from './template-office-parts';

// A row of desks side by side (one row: 16 px apart), each sitter facing up the canvas, toward the front.
const deskRow = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => ({ kind: 'desk' as const, x, y, facing: 's' as const }));

// --- Classroom ---------------------------------------------------------------------

const CLASS_W = 2000;
const CLASS_H = 1300;
// The classroom's top left on the site, for its Bring Focus.
const CLASS_X = 60;
const CLASS_Y = 60;

// The lesson board: how the class runs.
const CLASS_NOTES: readonly TemplateNote[] = [
  {
    title: 'Today’s lesson',
    text: 'We start together at the front, then split into the breakout rooms for the exercise. Your teacher says which room is yours.',
    color: 'yellow',
  },
  {
    title: 'In a breakout',
    text: 'Each breakout is a call of its own, with a Timer on the wall. When it rings, come back to the classroom.',
    color: 'green',
  },
  {
    title: 'Questions',
    text: 'Raise your hand from the Call dock, or pin a question here and we answer it at the end.',
    color: 'blue',
  },
];

// A breakout room on the right: a table to work round, a Screen to share on and a Timer for the exercise, its Door on
// the corridor between it and the classroom.
const breakout = (name: string, y: number): IndoorRoom => ({
  name,
  x: 1300,
  y,
  w: 640,
  h: 340,
  indoor: true,
  door: { side: 'w', at: 170, sign: 1 },
  windows: [{ side: 'e', at: 170 }],
  pieces: [
    { kind: 'screen', x: 226, y: 4, w: 128 },
    { kind: 'meeting-table', x: 200, y: 100 },
    { kind: 'timer', x: 480, y: 52 },
    { kind: 'plant', x: 560, y: 250 },
  ],
});

const CLASS_ROOMS: IndoorRoom[] = [
  {
    name: 'Classroom',
    x: CLASS_X,
    y: CLASS_Y,
    w: 1040,
    h: 760,
    indoor: true,
    door: { side: 's', at: 536, sign: 1 },
    windows: [
      { side: 'w', at: 300 },
      { side: 'w', at: 560 },
    ],
    pieces: [
      // The front: the lesson board, Bring Focus (placed below), the Screen, the teacher's desk facing the class and
      // a Timer.
      { kind: 'notice-board', x: 40, y: 40, notes: CLASS_NOTES },
      { kind: 'screen', x: 440, y: 4 },
      { kind: 'desk', x: 680, y: 60, facing: 'n' },
      { kind: 'timer', x: 880, y: 52 },
      // Two rows of six desks facing the front, either side of the aisle up from the door
      // (docs/specs/007-editor/templates-by-mode.md "Every Space is roomy").
      ...deskRow([80, 216, 352, 600, 736, 872], 300),
      ...deskRow([80, 216, 352, 600, 736, 872], 532),
    ],
  },
  breakout('Breakout 1', 60),
  breakout('Breakout 2', 460),
  breakout('Breakout 3', 860),
];

const CLASS_LOBBY: OfficePiece[] = [
  // Lockers for bags and a coat rack, water, and the Directory by the doors.
  { kind: 'lockers', x: 140, y: 880 },
  { kind: 'water-cooler', x: 330, y: 980 },
  { kind: 'coat-rack', x: 100, y: 1100 },
  { kind: 'plant', x: 900, y: 1150 },
  { kind: 'directory', x: CLASS_W / 2 + 80, y: 1160 },
];

export function buildClassroom(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: CLASS_W,
    height: CLASS_H,
    rooms: CLASS_ROOMS,
    open: CLASS_LOBBY,
    title: {
      text: 'Classroom',
      width: 260,
      sticker: 'emoji-books',
      subtitle:
        'Teach the whole class at the front, then split into three breakout rooms, each a call of its own.',
    },
    // In the lobby, in front of the classroom's door.
    arrival: {
      dx: -420,
      dy: 410,
      hint: 'You arrive on the Avatar Pad in the lobby. Take a desk in the Classroom, and Raise Hand when you have a question.',
    },
    // The teacher's Bring Focus at the front, beside the lesson board.
    extra: (left, top) => [createShape('focus-button', left + CLASS_X + 230, top + CLASS_Y + 40)],
  });
}

// --- Hackathon Hall ----------------------------------------------------------------

const HACK_W = 2200;
const HACK_H = 1480;
const STAGE_ROOM_X = 60;
const STAGE_ROOM_Y = 60;

// The rules and the prizes, on the floor's Notice Board.
const HACK_NOTES: readonly TemplateNote[] = [
  {
    title: 'How it works',
    text: 'Form a team at a table, build until the Timer runs out, then demo from the Main Stage. Five minutes a team.',
    color: 'yellow',
  },
  {
    title: 'Stuck?',
    text: 'Mentors are in the Mentor Room. Knock on its sign, and they let you in when they are free.',
    color: 'blue',
  },
  {
    title: 'Prizes',
    text: 'Best demo, boldest idea and the crowd’s favourite. Cheer for your favourite with a reaction from the stage seats.',
    color: 'pink',
  },
  {
    title: 'Look after yourself',
    text: 'Snacks and coffee in the Snack Bar, and a Nap Pod in the Nap Room when you need ten minutes.',
    color: 'green',
  },
];

const stools = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => ({ kind: 'bar-stool' as const, x, y }));
const chairRow = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => ({ kind: 'chair' as const, x, y, facing: 's' as const }));

const HACK_ROOMS: IndoorRoom[] = [
  {
    // The demo hall: a Stage with its cameras on and a Podium, a Screen either side, and twelve seats facing it
    // either side of a centre aisle (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage").
    name: 'Main Stage',
    x: STAGE_ROOM_X,
    y: STAGE_ROOM_Y,
    w: 1040,
    h: 700,
    indoor: true,
    door: { side: 's', at: 520, sign: 1 },
    windows: [{ side: 'w', at: 350 }],
    pieces: [
      { kind: 'screen', x: 100, y: 44 },
      { kind: 'stage', x: 340, y: 48, stageCameras: true },
      { kind: 'podium', x: 600, y: 70 },
      { kind: 'screen', x: 748, y: 44 },
      ...chairRow([200, 280, 360, 604, 684, 764], 300),
      ...chairRow([200, 280, 360, 604, 684, 764], 504),
    ],
  },
  {
    name: 'Mentor Room',
    x: 1180,
    y: 60,
    w: 480,
    h: 360,
    indoor: true,
    door: { side: 's', at: 240, sign: 1 },
    pieces: [
      { kind: 'screen', x: 180, y: 4, w: 120 },
      { kind: 'meeting-table', x: 124, y: 80 },
      { kind: 'plant', x: 24, y: 52 },
      { kind: 'plant', x: 400, y: 52 },
    ],
  },
  {
    // Two Nap Pods, each setting its sleeper to Focusing (docs/specs/009-elements/workday-pieces.md "Nap Pod").
    name: 'Nap Room',
    x: 1720,
    y: 60,
    w: 420,
    h: 360,
    indoor: true,
    door: { side: 's', at: 210, sign: 1 },
    windows: [{ side: 'e', at: 180 }],
    pieces: [
      { kind: 'nap-pod', x: 40, y: 60 },
      { kind: 'nap-pod', x: 280, y: 60 },
      { kind: 'plant', x: 30, y: 250 },
    ],
  },
  {
    name: 'Snack Bar',
    x: 1180,
    y: 620,
    w: 960,
    h: 340,
    indoor: true,
    door: { side: 's', at: 480, sign: 1 },
    windows: [{ side: 'e', at: 170 }],
    pieces: [
      { kind: 'bar', x: 40, y: 40 },
      { kind: 'bar', x: 280, y: 40 },
      ...stools([60, 120, 180, 240, 300, 360, 420, 480], 170),
      { kind: 'vending-machine', x: 560, y: 36 },
      { kind: 'drinks-fridge', x: 652, y: 36 },
      { kind: 'coffee-machine', x: 744, y: 48 },
      { kind: 'plant', x: 860, y: 44 },
    ],
  },
];

// A team table on the hack floor: a Meeting Table for six.
const table = (x: number, y: number): OfficePiece => ({ kind: 'meeting-table', x, y });

const HACK_FLOOR: OfficePiece[] = [
  // Six team tables in two rows of three, an aisle between every pair.
  table(60, 1000),
  table(412, 1000),
  table(764, 1000),
  table(60, 1290),
  table(412, 1290),
  table(764, 1290),
  // The rules on a board, the countdown on a Timer, and bean bags to think on.
  { kind: 'notice-board', x: 1400, y: 1250, notes: HACK_NOTES },
  { kind: 'timer', x: 1620, y: 1270 },
  { kind: 'rug', x: 1840, y: 1230, variant: 'round' },
  { kind: 'bean-bag', x: 1856, y: 1260 },
  { kind: 'bean-bag', x: 1932, y: 1260 },
  { kind: 'bean-bag', x: 1894, y: 1316 },
  { kind: 'directory', x: HACK_W / 2 + 80, y: 1350 },
  { kind: 'plant', x: 2080, y: 1380 },
];

export function buildHackathonHall(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: HACK_W,
    height: HACK_H,
    rooms: HACK_ROOMS,
    open: HACK_FLOOR,
    title: {
      text: 'Hackathon Hall',
      width: 320,
      sticker: 'emoji-laptop',
      subtitle:
        'Build at the team tables, get unstuck in the mentor room, refuel at the snack bar, and demo from the stage.',
    },
    // On the hack floor below the snack bar, the team tables and the stage's door in view.
    arrival: {
      dx: 300,
      dy: 330,
      hint: 'You arrive on the Avatar Pad on the hack floor. Join a team table, and demo from the Main Stage when time is up.',
    },
    // Bring Focus beside the stage, for the host calling everyone to the demos.
    extra: (left, top) => [
      createShape('focus-button', left + STAGE_ROOM_X + 900, top + STAGE_ROOM_Y + 200),
    ],
  });
}
