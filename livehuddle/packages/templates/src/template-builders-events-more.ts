// Two Events Spaces for learning and making together (docs/specs/012-collaboration/virtual-office-template.md
// "Classroom and Hackathon Hall", Work Tracker 1076): a Classroom with three breakout rooms to split into, and a
// Hackathon Hall with team tables on the floor, a demo stage, a mentor room, a nap room and a snack bar. Each is a
// building of closed rooms round a lobby or a floor that is a room of its own, sharing their walls (`campusPlan` with
// indoor rooms): every room has a Door and a Room Sign inside it, and a Directory stands by the entrance. Drawn at
// their final size for the 3D view (virtual-office-template.md "Laid out for the 3D view").
//
// Each builder is pure apart from the Notice Board's pin time (template-notes.ts): it takes a centre (cx, cy) and
// returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import { campusPlan, type IndoorRoom } from './template-campus-parts';
import type { TemplateNote } from './template-notes';
import type { OfficePiece } from './template-office-parts';
import { against, besideX, belowY, standAt, withSigns, sofaOnRug } from './template-3d-place';

// A row of desks side by side, each sitter facing up the room, toward the front (models centred on `y`).
const deskRow = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => standAt('desk', x, y, 's'));
// A row of chairs facing up the room.
const chairRow = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => standAt('chair', x, y, 's'));

// The arrival's offset from the plan's centre for a site point (campusPlan centres the site under its old heading's band).
const padAt = (width: number, height: number, x: number, y: number) => ({
  dx: x - width / 2,
  dy: 96 + y - (96 + height + 120) / 2,
});

// --- Classroom ---------------------------------------------------------------------

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

// The classroom, the lobby down its right side, and the three breakouts down the lobby's other side.
const CLASS = { x: 75, y: 75, w: 1250, h: 950 };
const LOBBY = { x: besideX(CLASS), y: 75, w: 400, h: 0 };
const B1 = { x: besideX(LOBBY), y: 75, w: 800, h: 445 };
const B2 = { ...B1, y: belowY(B1) };
const B3 = { ...B1, y: belowY(B2) };
LOBBY.h = B3.y + B3.h - LOBBY.y;
const CLASS_W = B1.x + B1.w + 75;
const CLASS_H = LOBBY.y + LOBBY.h + 75;

// A breakout room: a table under a Screen, and a Timer for the exercise.
const breakout = (name: string, box: typeof B1): IndoorRoom => ({
  name,
  ...box,
  indoor: true,
  door: { side: 'w', at: 222, sign: 1 },
  windows: [{ side: 'e', at: 222 }],
  pieces: [
    against('screen', 'n', 400, box),
    { kind: 'meeting-table', x: 284, y: 170 },
    { kind: 'timer', x: 600, y: 60 },
    against('plant', 's', 740, box),
  ],
});

const classRooms = (): IndoorRoom[] => [
  {
    name: 'Classroom',
    ...CLASS,
    indoor: true,
    door: { side: 'e', at: 800, sign: -1 },
    windows: [
      { side: 'w', at: 350 },
      { side: 'w', at: 650 },
    ],
    pieces: [
      against('notice-board', 'n', 150, CLASS, { notes: CLASS_NOTES }),
      against('screen', 'n', 625, CLASS),
      // The teacher's desk, its sitter facing the class.
      standAt('desk', 900, 170, 'n'),
      { kind: 'timer', x: 1060, y: 60 },
      // Two rows of six either side of a centre aisle, every sitter facing the front.
      ...deskRow([170, 300, 430, 820, 950, 1080], 420),
      ...deskRow([170, 300, 430, 820, 950, 1080], 680),
    ],
  },
  {
    name: 'Lobby',
    ...LOBBY,
    indoor: true,
    door: { side: 's', at: 200, sign: 1 },
    pieces: [
      against('water-cooler', 'w', 300, LOBBY),
      against('lockers', 'w', 1100, LOBBY),
      against('coat-rack', 's', 80, LOBBY),
      standAt('directory', 200, 920),
      against('plant', 'n', 60, LOBBY),
    ],
  },
  breakout('Breakout 1', B1),
  breakout('Breakout 2', B2),
  breakout('Breakout 3', B3),
];

export function buildClassroom(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: CLASS_W,
    height: CLASS_H,
    rooms: withSigns(classRooms()),
    // Each room's sign hangs inside it by its Door, as every Door opens onto the Lobby.
    signs: false,
    open: [],
    arrival: padAt(CLASS_W, CLASS_H, LOBBY.x + LOBBY.w / 2, 600),
  });
}

// --- Hackathon Hall ----------------------------------------------------------------

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

// Across the top the Main Stage, the Mentor Room and the Nap Room; below them the Snack Bar and the floor of team
// tables, sharing their walls.
const STAGE_ROOM = { x: 75, y: 75, w: 1300, h: 875 };
const MENTOR = { x: besideX(STAGE_ROOM), y: 75, w: 600, h: 875 };
const NAP = { x: besideX(MENTOR), y: 75, w: 525, h: 875 };
const SNACK = { x: 75, y: belowY(STAGE_ROOM), w: 700, h: 750 };
const FLOOR = { x: besideX(SNACK), y: SNACK.y, w: NAP.x + NAP.w - besideX(SNACK), h: 750 };
const HACK_W = FLOOR.x + FLOOR.w + 75;
const HACK_H = FLOOR.y + FLOOR.h + 75;

const hackRooms = (): IndoorRoom[] => [
  {
    name: 'Main Stage',
    ...STAGE_ROOM,
    indoor: true,
    door: { side: 's', at: 1000, sign: 1 },
    windows: [{ side: 'w', at: 450 }],
    pieces: [
      against('screen', 'n', 200, STAGE_ROOM),
      { kind: 'stage', x: 470, y: 36, stageCameras: true },
      standAt('podium', 760, 120),
      against('screen', 'n', 1100, STAGE_ROOM),
      // The demo seats: two rows of six facing the stage either side of an aisle.
      ...chairRow([390, 470, 550, 750, 830, 910], 420),
      ...chairRow([390, 470, 550, 750, 830, 910], 630),
    ],
  },
  {
    name: 'Mentor Room',
    ...MENTOR,
    indoor: true,
    door: { side: 's', at: 200, sign: 1 },
    pieces: [
      against('screen', 'n', 300, MENTOR),
      { kind: 'meeting-table', x: 184, y: 200 },
      against('plant', 'n', 60, MENTOR),
      against('plant', 'n', 540, MENTOR),
      // A sofa on the right wall to wait on, looking over its rug.
      ...sofaOnRug('e', 620, MENTOR, { w: 140, h: 200 }),
    ],
  },
  {
    name: 'Nap Room',
    ...NAP,
    indoor: true,
    door: { side: 's', at: 260, sign: 1 },
    windows: [{ side: 'e', at: 400 }],
    pieces: [
      standAt('nap-pod', 140, 170),
      standAt('nap-pod', 385, 170),
      against('plant', 'w', 700, NAP),
    ],
  },
  {
    name: 'Snack Bar',
    ...SNACK,
    indoor: true,
    door: { side: 'e', at: 375, sign: 1 },
    windows: [{ side: 'w', at: 640 }],
    pieces: [
      against('bar', 'n', 140, SNACK),
      against('bar', 'n', 380, SNACK),
      ...[70, 130, 190, 250, 310, 370, 430, 490].map((x) => standAt('bar-stool', x, 126, 's')),
      against('vending-machine', 'w', 450, SNACK),
      against('drinks-fridge', 'n', 580, SNACK),
      against('coffee-machine', 'n', 655, SNACK),
      against('plant', 's', 640, SNACK),
    ],
  },
  {
    // The floor of team tables, the board of how it works, a Timer for the build, and Bean Bags to rest on.
    name: 'Hack Floor',
    ...FLOOR,
    indoor: true,
    door: { side: 's', at: 1000, sign: 1 },
    pieces: [
      ...[250, 700, 1150].flatMap((x): OfficePiece[] => [
        { kind: 'meeting-table', x, y: 220 },
        { kind: 'meeting-table', x, y: 510 },
      ]),
      against('notice-board', 'e', 200, FLOOR, { notes: HACK_NOTES }),
      { kind: 'timer', x: 1260, y: 100 },
      { kind: 'rug', x: 1480, y: 300, variant: 'round' },
      ...[1490, 1560, 1630].map((x) => standAt('bean-bag', x, 440, 's')),
      standAt('directory', 1500, 640),
      against('plant', 's', 60, FLOOR),
      against('plant', 's', FLOOR.w - 60, FLOOR),
    ],
  },
];

export function buildHackathonHall(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: HACK_W,
    height: HACK_H,
    rooms: withSigns(hackRooms()),
    // Each room's sign hangs inside it by its Door, as every Door opens onto the Hack Floor.
    signs: false,
    open: [],
    arrival: padAt(HACK_W, HACK_H, FLOOR.x + 1050, FLOOR.y + 420),
  });
}
