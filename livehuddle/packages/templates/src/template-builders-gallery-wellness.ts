// Two Spaces unlike the rest of the set (docs/specs/012-collaboration/virtual-office-template.md "Art Gallery and
// Wellness Studio", the owner 2026-11-18: "add any missing templates that would be valuable"): an Art Gallery for a
// show, a launch or a portfolio review, and a Wellness Studio for a team's yoga, meditation and quiet time. Each is a
// building of closed rooms off an open floor, as the Interview Suite is (`campusPlan` with indoor rooms): every room
// has a Door and a Room Sign, and a Directory stands by the entrance.
//
// Each builder is pure apart from the Notice Board's pin time (template-notes.ts): it takes a centre (cx, cy) and
// returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import { campusPlan, type IndoorRoom } from './template-campus-parts';
import type { TemplateNote } from './template-notes';
import type { OfficePiece } from './template-office-parts';

const bench = (x: number, y: number): OfficePiece => ({ kind: 'bench', x, y });
const chairRow = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => ({ kind: 'chair' as const, x, y, facing: 's' as const }));
const stools = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => ({ kind: 'bar-stool' as const, x, y }));

// --- Art Gallery -------------------------------------------------------------------

const GALLERY_W = 2200;
const GALLERY_H = 1320;

const GALLERY_NOTES: readonly TemplateNote[] = [
  {
    title: 'Welcome to the show',
    text: 'Walk the Main Gallery and the Sculpture Hall. Every Photo Wall holds pictures: open one to see them large.',
    color: 'yellow',
  },
  {
    title: 'The artist talk',
    text: 'Find a seat in the Talk Room. The speaker presents from the Podium, and everyone in the room hears them.',
    color: 'blue',
  },
  {
    title: 'Hang your own',
    text: 'In Edit, open a Photo Wall’s menu to add your pictures, or drag a new one from the palette onto a wall.',
    color: 'green',
  },
];

const GALLERY_ROOMS: IndoorRoom[] = [
  {
    // Photo Walls along the back wall, benches to sit and look, pillars framing the room.
    name: 'Main Gallery',
    x: 60,
    y: 60,
    w: 860,
    h: 640,
    indoor: true,
    door: { side: 's', at: 430, sign: 1 },
    windows: [{ side: 'w', at: 320 }],
    pieces: [
      { kind: 'photo-wall', x: 60, y: 4 },
      { kind: 'photo-wall', x: 342, y: 4 },
      { kind: 'photo-wall', x: 624, y: 4 },
      bench(240, 330),
      bench(484, 330),
      { kind: 'pillar', x: 40, y: 260 },
      { kind: 'pillar', x: 772, y: 260 },
      { kind: 'plant', x: 24, y: 560 },
      { kind: 'plant', x: 772, y: 560 },
    ],
  },
  {
    // Columns as plinths down the middle, a long runner to walk between them, Photo Walls on the back wall.
    name: 'Sculpture Hall',
    x: 980,
    y: 60,
    w: 700,
    h: 640,
    indoor: true,
    door: { side: 's', at: 350, sign: 1 },
    windows: [{ side: 'n', at: 350 }],
    pieces: [
      { kind: 'photo-wall', x: 80, y: 4 },
      { kind: 'photo-wall', x: 444, y: 4 },
      { kind: 'rug', x: 290, y: 220, variant: 'runner', w: 120, h: 300 },
      { kind: 'column', x: 180, y: 180 },
      { kind: 'column', x: 456, y: 180 },
      { kind: 'column', x: 180, y: 370 },
      { kind: 'column', x: 456, y: 370 },
      bench(40, 540),
      bench(524, 540),
    ],
  },
  {
    // The artist talk: a Podium under a Screen, two rows of seats facing it.
    name: 'Talk Room',
    x: 1740,
    y: 60,
    w: 400,
    h: 640,
    indoor: true,
    door: { side: 's', at: 200, sign: -1 },
    windows: [{ side: 'e', at: 320 }],
    pieces: [
      { kind: 'screen', x: 140, y: 4, w: 120 },
      { kind: 'podium', x: 168, y: 120 },
      ...chairRow([74, 162, 250], 260),
      ...chairRow([74, 162, 250], 480),
    ],
  },
];

const GALLERY_FLOOR: OfficePiece[] = [
  // The foyer: the front desk, the visitors' board, and a café corner to talk the show over.
  { kind: 'reception-desk', x: 160, y: 860 },
  { kind: 'notice-board', x: 60, y: 1080, notes: GALLERY_NOTES },
  { kind: 'coat-rack', x: 480, y: 1080 },
  { kind: 'umbrella-stand', x: 560, y: 1120 },
  { kind: 'bar', x: 1500, y: 860 },
  ...stools([1520, 1580, 1640, 1700], 990),
  { kind: 'coffee-machine', x: 1780, y: 860 },
  { kind: 'drinks-fridge', x: 1880, y: 840 },
  { kind: 'rug', x: 1600, y: 1110, variant: 'round' },
  { kind: 'bean-bag', x: 1640, y: 1140 },
  { kind: 'bean-bag', x: 1706, y: 1140 },
  { kind: 'directory', x: GALLERY_W / 2 + 80, y: 1180 },
  { kind: 'plant', x: 40, y: 1220 },
  { kind: 'plant', x: 2100, y: 1220 },
];

export function buildArtGallery(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: GALLERY_W,
    height: GALLERY_H,
    rooms: GALLERY_ROOMS,
    open: GALLERY_FLOOR,
    title: {
      text: 'Art Gallery',
      width: 280,
      sticker: 'emoji-gem',
      subtitle:
        'Walk the show together: pictures in the galleries, sculpture in the hall, a talk from the artist, coffee in the foyer.',
    },
    arrival: {
      dx: -260,
      dy: 360,
      hint: 'You arrive on the Avatar Pad in the foyer. Walk into the Main Gallery, or find a seat for the talk.',
    },
  });
}

// --- Wellness Studio ---------------------------------------------------------------

const WELL_W = 2100;
const WELL_H = 1340;

const WELL_NOTES: readonly TemplateNote[] = [
  {
    title: 'Class times',
    text: 'Yoga at the top of every hour in the Yoga Studio. The teacher starts the Timer and presses Bring Focus.',
    color: 'green',
  },
  {
    title: 'Quiet, please',
    text: 'The Meditation Room and the Nap Room are calls of their own: nobody outside hears you, and you hear nobody.',
    color: 'blue',
  },
  {
    title: 'Look after yourself',
    text: 'Water and juice at the bar, the treadmills in the Gym, and a Nap Pod sets you to Focusing while you rest.',
    color: 'yellow',
  },
];

// A yoga mat: a runner rug, laid lengthways.
const mat = (x: number, y: number): OfficePiece => ({
  kind: 'rug',
  x,
  y,
  variant: 'runner',
  w: 88,
  h: 200,
});

const WELL_ROOMS: IndoorRoom[] = [
  {
    // Six mats facing the teacher's, a Screen to follow, a Timer for the class and Bring Focus to gather everyone.
    name: 'Yoga Studio',
    x: 60,
    y: 60,
    w: 900,
    h: 640,
    indoor: true,
    door: { side: 's', at: 450, sign: 1 },
    windows: [
      { side: 'w', at: 320 },
      { side: 'n', at: 200 },
    ],
    pieces: [
      { kind: 'screen', x: 390, y: 4, w: 120 },
      mat(406, 100),
      ...[140, 300, 460, 620].map((x) => mat(x, 360)),
      { kind: 'timer', x: 700, y: 60 },
      { kind: 'focus-button', x: 120, y: 60 },
      { kind: 'plant', x: 24, y: 560 },
      { kind: 'plant', x: 812, y: 560 },
    ],
  },
  {
    // A fountain to listen to, bean bags round it, plants all round.
    name: 'Meditation Room',
    x: 1020,
    y: 60,
    w: 560,
    h: 640,
    indoor: true,
    door: { side: 's', at: 280, sign: 1 },
    windows: [{ side: 'n', at: 280 }],
    pieces: [
      { kind: 'rug', x: 140, y: 220, variant: 'round', w: 280, h: 280 },
      { kind: 'fountain', x: 212, y: 300 },
      { kind: 'bean-bag', x: 130, y: 230 },
      { kind: 'bean-bag', x: 366, y: 230 },
      { kind: 'bean-bag', x: 130, y: 440 },
      { kind: 'bean-bag', x: 366, y: 440 },
      { kind: 'plant', x: 24, y: 52 },
      { kind: 'plant', x: 476, y: 52 },
      { kind: 'plant', x: 24, y: 560 },
      { kind: 'plant', x: 476, y: 560 },
    ],
  },
  {
    // Treadmills along the back wall, lockers by the door, water on the side.
    name: 'Gym',
    x: 1640,
    y: 60,
    w: 400,
    h: 640,
    indoor: true,
    door: { side: 's', at: 200, sign: -1 },
    windows: [{ side: 'e', at: 320 }],
    pieces: [
      { kind: 'treadmill', x: 80, y: 40 },
      { kind: 'treadmill', x: 164, y: 40 },
      { kind: 'treadmill', x: 248, y: 40 },
      { kind: 'lockers', x: 300, y: 380 },
      { kind: 'water-cooler', x: 24, y: 400 },
    ],
  },
  {
    // Two Nap Pods and a reading nook, each a quiet place of its own.
    name: 'Nap Room',
    x: 1460,
    y: 880,
    w: 580,
    h: 400,
    indoor: true,
    door: { side: 'w', at: 220, sign: 1 },
    windows: [{ side: 'e', at: 220 }],
    pieces: [
      { kind: 'nap-pod', x: 120, y: 60 },
      { kind: 'nap-pod', x: 360, y: 60 },
      { kind: 'reading-nook', x: 300, y: 250 },
      { kind: 'plant', x: 40, y: 300 },
    ],
  },
];

const WELL_FLOOR: OfficePiece[] = [
  // The lobby: the front desk, the class board, and a juice bar.
  { kind: 'reception-desk', x: 120, y: 860 },
  { kind: 'notice-board', x: 60, y: 1100, notes: WELL_NOTES },
  { kind: 'bar', x: 760, y: 860 },
  ...stools([780, 840, 900, 960], 990),
  { kind: 'drinks-fridge', x: 1040, y: 840 },
  { kind: 'water-cooler', x: 1136, y: 856 },
  { kind: 'hammock', x: 1180, y: 1060 },
  { kind: 'directory', x: WELL_W / 2 - 200, y: 1200 },
  { kind: 'plant', x: 40, y: 1240 },
  { kind: 'plant', x: 1360, y: 1240 },
];

export function buildWellnessStudio(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: WELL_W,
    height: WELL_H,
    rooms: WELL_ROOMS,
    open: WELL_FLOOR,
    title: {
      text: 'Wellness Studio',
      width: 320,
      sticker: 'emoji-herb',
      subtitle:
        'Time out together: a yoga class, a quiet room to meditate, a gym, a nap room and a juice bar in the lobby.',
    },
    arrival: {
      dx: -340,
      dy: 380,
      hint: 'You arrive on the Avatar Pad in the lobby. Join a class in the Yoga Studio, or find somewhere quiet.',
    },
  });
}
