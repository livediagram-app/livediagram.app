// Two Office Spaces for meeting people from outside the team (docs/specs/012-collaboration/virtual-office-template.md
// "Interview Suite and Client Lounge", Work Tracker 1076): an Interview Suite with a waiting area, two closed interview
// rooms and a debrief room, and a Client Lounge with a boardroom round a Long Table, a glass pitch room, a quiet room
// for calls and a coffee bar. Each is a building of closed rooms off an open floor, as the Games Rooms are
// (`campusPlan` with indoor rooms): every room has a Door, a Room Sign to knock at and 160 px of open floor in front of
// its Door, a Reception Desk greets whoever walks in, and a Directory stands by the entrance.
//
// Each builder is pure apart from the Notice Board's pin time (template-notes.ts): it takes a centre (cx, cy) and
// returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import { campusPlan, type IndoorRoom } from './template-campus-parts';
import type { TemplateNote } from './template-notes';
import type { OfficePiece } from './template-office-parts';

// --- Interview Suite ---------------------------------------------------------------

const SUITE_W = 1800;
const SUITE_H = 1000;
const SUITE_ROOM_H = 400;
// Three rooms side by side, each a wall's width over the last so they share one wall (office.md "Rooms line up").
const SUITE_ROOM_W = 570;
const suiteRoomX = (i: number) => 60 + i * (SUITE_ROOM_W - 10);

// An interview room: a table for the candidate and the panel, a Screen on the back wall for a portfolio or a coding
// exercise (docs/specs/009-elements/screen-and-room-sign.md), and its walls keeping the call to the room
// (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Rooms are calls").
const interviewRoom = (name: string, x: number, windows: IndoorRoom['windows']): IndoorRoom => ({
  name,
  x,
  y: 60,
  w: SUITE_ROOM_W,
  h: SUITE_ROOM_H,
  indoor: true,
  door: { side: 's', at: SUITE_ROOM_W / 2, sign: 1 },
  windows,
  pieces: [
    { kind: 'screen', x: SUITE_ROOM_W / 2 - 60, y: 4, w: 120 },
    { kind: 'meeting-table', x: SUITE_ROOM_W / 2 - 116, y: 110 },
    { kind: 'plant', x: 24, y: 52 },
    { kind: 'plant', x: SUITE_ROOM_W - 80, y: 52 },
  ],
});

const SUITE_ROOMS: IndoorRoom[] = [
  interviewRoom('Interview 1', suiteRoomX(0), [{ side: 'w', at: 230 }]),
  interviewRoom('Interview 2', suiteRoomX(1), [{ side: 'n', at: 400 }]),
  {
    // Where the panel meets after an interview, out of the candidates' way.
    name: 'Debrief Room',
    x: suiteRoomX(2),
    y: 60,
    w: SUITE_ROOM_W,
    h: SUITE_ROOM_H,
    indoor: true,
    door: { side: 's', at: SUITE_ROOM_W / 2, sign: 1 },
    windows: [{ side: 'e', at: 230 }],
    pieces: [
      { kind: 'screen', x: SUITE_ROOM_W / 2 - 60, y: 4, w: 120 },
      { kind: 'meeting-table', x: SUITE_ROOM_W / 2 - 116, y: 120 },
      // A Timer to keep the debrief short (docs/specs/009-elements/timer-and-stopwatch.md).
      { kind: 'timer', x: 440, y: 44 },
      // The water cooler on the left wall, clear of the table's chairs.
      { kind: 'water-cooler', x: 12, y: 150, facing: 'w' },
    ],
  },
];

// The waiting area's Notice Board: what a candidate wants to know while they wait.
const SUITE_NOTES: readonly TemplateNote[] = [
  {
    title: 'Welcome, and good luck',
    text: 'Take a seat. Your interviewer walks out to meet you here when it is time, so there is nothing to book.',
    color: 'yellow',
  },
  {
    title: 'Is the room free?',
    text: 'The sign by each door shows who is in. If yours is in use, press Knock on its sign and wait to be let in.',
    color: 'blue',
  },
  {
    title: 'Before you start',
    text: 'Check your camera and microphone in the Call dock, and grab a coffee or a glass of water.',
    color: 'green',
  },
];

const SUITE_FLOOR: OfficePiece[] = [
  // The waiting area: the board, two sofas on rugs an aisle apart, coffee and water, and a Phone Booth for a quiet
  // call before it starts (docs/specs/009-elements/workday-pieces.md "Phone Booth").
  { kind: 'notice-board', x: 60, y: 640, notes: SUITE_NOTES },
  { kind: 'rug', x: 260, y: 660 },
  { kind: 'sofa', x: 284, y: 680, facing: 'n' },
  { kind: 'rug', x: 540, y: 660 },
  { kind: 'sofa', x: 564, y: 680, facing: 'n' },
  // A Clock on Interview 1's front wall over the waiting area.
  { kind: 'world-clock', x: 532, y: 480 },
  // Coffee and water against the Debrief Room's front wall, right of its door.
  { kind: 'coffee-machine', x: 1580, y: 470 },
  { kind: 'water-cooler', x: 1670, y: 470 },
  // A Phone Booth against the Debrief Room's front wall, left of its door, facing the waiting area.
  { kind: 'phone-booth', x: 1260, y: 470 },
  // The front desk by the entrance: whoever walks in is welcomed, and its bell calls the interviewer.
  { kind: 'reception-desk', x: 560, y: 860 },
  { kind: 'directory', x: SUITE_W / 2 + 80, y: 860 },
  { kind: 'plant', x: 40, y: 900 },
  { kind: 'plant', x: 1700, y: 900 },
];

export function buildInterviewSuite(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: SUITE_W,
    height: SUITE_H,
    rooms: SUITE_ROOMS,
    open: SUITE_FLOOR,
    // In the waiting area, the interview rooms' doors and signs ahead.
    arrival: {
      dx: 0,
      dy: 200,
    },
  });
}

// --- Client Lounge -----------------------------------------------------------------

const LOUNGE_W = 1960;
const LOUNGE_H = 1160;

const LOUNGE_ROOMS: IndoorRoom[] = [
  {
    // A Long Table for the big meeting (docs/specs/009-elements/office.md "Long Table"), the Screen over its middle and a
    // Clock.
    name: 'Boardroom',
    x: 60,
    y: 60,
    w: 760,
    h: 480,
    indoor: true,
    door: { side: 's', at: 380, sign: 1 },
    windows: [
      { side: 'n', at: 140 },
      { side: 'w', at: 240 },
    ],
    pieces: [
      { kind: 'screen', x: 284, y: 4 },
      { kind: 'world-clock', x: 572, y: 44 },
      { kind: 'meeting-table', x: 100, y: 160, variant: 'long' },
      { kind: 'plant', x: 24, y: 52 },
      { kind: 'plant', x: 700, y: 52 },
    ],
  },
  {
    // Glass, so a client waiting in the lounge sees the pitch is on.
    name: 'Pitch Room',
    // A wall's width over the Boardroom's, and the Quiet Room a wall's width over it: one wall between each.
    x: 810,
    y: 60,
    w: 560,
    h: 400,
    indoor: true,
    glass: true,
    door: { side: 's', at: 280, sign: 1, variant: 'sliding' },
    pieces: [
      { kind: 'screen', x: 200, y: 4, w: 160 },
      { kind: 'meeting-table', x: 164, y: 120 },
      { kind: 'plant', x: 24, y: 52 },
      { kind: 'plant', x: 480, y: 52 },
    ],
  },
  {
    // Two Phone Booths and an Office Pod, each a call of its own, for a call the room should not hear.
    name: 'Quiet Room',
    x: 1360,
    y: 60,
    w: 540,
    h: 400,
    indoor: true,
    door: { side: 's', at: 240, sign: 1 },
    windows: [{ side: 'e', at: 200 }],
    pieces: [
      { kind: 'phone-booth', x: 100, y: 60 },
      { kind: 'phone-booth', x: 196, y: 60 },
      { kind: 'office-pod', x: 280, y: 60 },
      { kind: 'plant', x: 24, y: 300 },
    ],
  },
];

const stools = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => ({ kind: 'bar-stool' as const, x, y }));

const LOUNGE_FLOOR: OfficePiece[] = [
  // The lounge: two sofas on rugs an aisle apart, to wait or talk in.
  { kind: 'rug', x: 100, y: 760 },
  { kind: 'sofa', x: 124, y: 780, facing: 'n' },
  { kind: 'rug', x: 396, y: 760 },
  { kind: 'sofa', x: 420, y: 780, facing: 'n' },
  // The coffee bar: a bar with stools, and behind it a coffee machine and a drinks fridge against the Quiet Room's
  // front wall, right of its door.
  { kind: 'bar', x: 1500, y: 700 },
  ...stools([1520, 1580, 1640, 1700], 830),
  { kind: 'coffee-machine', x: 1720, y: 470 },
  { kind: 'drinks-fridge', x: 1810, y: 470 },
  // The front desk by the entrance, its Welcome and its bell for a client arriving.
  { kind: 'reception-desk', x: 800, y: 1000 },
  { kind: 'directory', x: LOUNGE_W / 2 + 80, y: 1020 },
  { kind: 'plant', x: 40, y: 1040 },
  { kind: 'plant', x: 1880, y: 1040 },
];

export function buildClientLounge(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: LOUNGE_W,
    height: LOUNGE_H,
    rooms: LOUNGE_ROOMS,
    open: LOUNGE_FLOOR,
    // In the lounge, the front desk behind and every room's door ahead.
    arrival: {
      dx: 0,
      dy: 240,
    },
  });
}
