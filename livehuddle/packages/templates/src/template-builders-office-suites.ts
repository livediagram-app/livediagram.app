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

// An interview room: a table for the candidate and the panel, a Screen on the back wall for a portfolio or a coding
// exercise (docs/specs/009-elements/screen-and-room-sign.md), and its walls keeping the call to the room
// (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Rooms are calls").
const interviewRoom = (name: string, x: number, windows: IndoorRoom['windows']): IndoorRoom => ({
  name,
  x,
  y: 60,
  w: 520,
  h: SUITE_ROOM_H,
  indoor: true,
  door: { side: 's', at: 260, sign: 1 },
  windows,
  pieces: [
    { kind: 'screen', x: 200, y: 4, w: 120 },
    { kind: 'meeting-table', x: 144, y: 110 },
    { kind: 'plant', x: 24, y: 52 },
    { kind: 'plant', x: 440, y: 52 },
  ],
});

const SUITE_ROOMS: IndoorRoom[] = [
  interviewRoom('Interview Room 1', 60, [{ side: 'w', at: 230 }]),
  interviewRoom('Interview Room 2', 640, [{ side: 'n', at: 400 }]),
  {
    // Where the panel meets after an interview, out of the candidates' way.
    name: 'Debrief Room',
    x: 1220,
    y: 60,
    w: 520,
    h: SUITE_ROOM_H,
    indoor: true,
    door: { side: 's', at: 260, sign: 1 },
    windows: [{ side: 'e', at: 230 }],
    pieces: [
      { kind: 'screen', x: 200, y: 4, w: 120 },
      { kind: 'meeting-table', x: 120, y: 110 },
      // A Timer to keep the debrief short (docs/specs/009-elements/timer-and-stopwatch.md).
      { kind: 'timer', x: 384, y: 44 },
      { kind: 'water-cooler', x: 24, y: 40 },
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
  // A World Clock over the waiting area, for a candidate joining from another time zone.
  { kind: 'world-clock', x: 1240, y: 640 },
  { kind: 'coffee-machine', x: 1440, y: 660 },
  { kind: 'water-cooler', x: 1536, y: 644 },
  { kind: 'phone-booth', x: 1660, y: 640 },
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
    title: {
      text: 'Interview Suite',
      width: 320,
      sticker: 'emoji-clipboard',
      subtitle:
        'Candidates wait in comfort, each interview has a closed room of its own, and the panel debriefs next door.',
    },
    // In the waiting area, the interview rooms' doors and signs ahead.
    arrival: {
      dx: 0,
      dy: 200,
      hint: 'You arrive on the Avatar Pad in the waiting area. Ring the bell at the front desk, or knock on an interview room’s sign.',
    },
  });
}

// --- Client Lounge -----------------------------------------------------------------

const LOUNGE_W = 1960;
const LOUNGE_H = 1160;

const LOUNGE_ROOMS: IndoorRoom[] = [
  {
    // A Long Table for the big meeting (docs/specs/009-elements/office.md "Long Table"), the Screen over its middle and a
    // World Clock for clients joining from elsewhere.
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
      { kind: 'world-clock', x: 520, y: 44 },
      { kind: 'meeting-table', x: 100, y: 160, variant: 'long' },
      { kind: 'plant', x: 24, y: 52 },
      { kind: 'plant', x: 700, y: 52 },
    ],
  },
  {
    // Glass, so a client waiting in the lounge sees the pitch is on.
    name: 'Pitch Room',
    x: 880,
    y: 60,
    w: 480,
    h: 400,
    indoor: true,
    glass: true,
    door: { side: 's', at: 240, sign: 1, variant: 'sliding' },
    pieces: [
      { kind: 'screen', x: 160, y: 4, w: 160 },
      { kind: 'meeting-table', x: 124, y: 120 },
      { kind: 'plant', x: 24, y: 52 },
      { kind: 'plant', x: 400, y: 52 },
    ],
  },
  {
    // Two Phone Booths and an Office Pod, each a call of its own, for a call the room should not hear.
    name: 'Quiet Room',
    x: 1420,
    y: 60,
    w: 480,
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
  // The coffee bar: a bar with stools, a coffee machine and a drinks fridge behind its end.
  { kind: 'bar', x: 1500, y: 700 },
  ...stools([1520, 1580, 1640, 1700], 830),
  { kind: 'coffee-machine', x: 1770, y: 712 },
  { kind: 'drinks-fridge', x: 1860, y: 700 },
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
    title: {
      text: 'Client Lounge',
      width: 300,
      sticker: 'emoji-sparkles',
      subtitle:
        'Welcome clients at the front desk, pitch in the glass room, and seal it round the Long Table in the boardroom.',
    },
    // In the lounge, the front desk behind and every room's door ahead.
    arrival: {
      dx: 0,
      dy: 240,
      hint: 'You arrive on the Avatar Pad in the lounge. Grab a coffee at the bar, then knock on the Boardroom’s sign.',
    },
  });
}
