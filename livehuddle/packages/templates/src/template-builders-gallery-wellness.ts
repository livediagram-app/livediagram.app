// Two Spaces unlike the rest of the set (docs/specs/012-collaboration/virtual-office-template.md "Art Gallery and
// Wellness Studio", the owner 2026-11-18: "add any missing templates that would be valuable"): an Art Gallery for a
// show, a launch or a portfolio review, and a Wellness Studio for a team's yoga, meditation and quiet time. Each is a
// building of closed rooms off a foyer or lobby, a room of its own sharing their walls (`campusPlan` with indoor
// rooms): every room has a Door and a Room Sign inside it, and a Directory stands by the entrance. Drawn at their
// final size for the 3D view (virtual-office-template.md "Laid out for the 3D view").
//
// Each builder is pure apart from the Notice Board's pin time (template-notes.ts): it takes a centre (cx, cy) and
// returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import { campusPlan, type IndoorRoom } from './template-campus-parts';
import type { TemplateNote } from './template-notes';
import type { OfficePiece } from './template-office-parts';
import { against, besideX, belowY, standAt, withSigns } from './template-3d-place';

// A row of chairs facing up the room, models centred on `y`.
const chairRow = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => standAt('chair', x, y, 's'));

// The arrival's offset from the plan's centre for a site point (campusPlan centres the site under its old heading's band).
const padAt = (width: number, height: number, x: number, y: number) => ({
  dx: x - width / 2,
  dy: 96 + y - (96 + height + 120) / 2,
});

// Three Bean Bags side by side along the bottom of a round rug, its top left at (x, y), facing up across it.
const beanBags = (x: number, y: number): OfficePiece[] => [
  { kind: 'rug', x, y, variant: 'round' },
  ...[10, 80, 150].map((dx) => standAt('bean-bag', x + dx, y + 140, 's')),
];

// --- Art Gallery -------------------------------------------------------------------

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

const MAIN = { x: 75, y: 75, w: 1075, h: 800 };
const SCULPTURE = { x: besideX(MAIN), y: 75, w: 875, h: 800 };
const TALK = { x: besideX(SCULPTURE), y: 75, w: 500, h: 800 };
const FOYER = { x: 75, y: belowY(MAIN), w: TALK.x + TALK.w - 75, h: 640 };
const GALLERY_W = FOYER.x + FOYER.w + 75;
const GALLERY_H = FOYER.y + FOYER.h + 75;

const galleryRooms = (): IndoorRoom[] => [
  {
    // Photo Walls along the back wall, benches to sit and look at them, pillars framing the room.
    name: 'Main Gallery',
    ...MAIN,
    indoor: true,
    door: { side: 's', at: 537, sign: 1 },
    windows: [{ side: 'w', at: 400 }],
    pieces: [
      // A runner along the wall of pictures, the benches looking over it at them.
      { kind: 'rug', x: 150, y: 200, variant: 'runner', w: 775, h: 120 },
      against('photo-wall', 'n', 200, MAIN),
      against('photo-wall', 'n', 537, MAIN),
      against('photo-wall', 'n', 875, MAIN),
      standAt('bench', 330, 430, 's'),
      standAt('bench', 745, 430, 's'),
      standAt('pillar', 110, 330),
      standAt('pillar', 965, 330),
      against('plant', 's', 60, MAIN),
      against('plant', 's', 1015, MAIN),
    ],
  },
  {
    // Columns as plinths down the middle, a long runner to walk between them, Photo Walls on the back wall.
    name: 'Sculpture Hall',
    ...SCULPTURE,
    indoor: true,
    door: { side: 's', at: 437, sign: 1 },
    windows: [{ side: 'n', at: 437 }],
    pieces: [
      against('photo-wall', 'n', 180, SCULPTURE),
      against('photo-wall', 'n', 695, SCULPTURE),
      { kind: 'rug', x: 377, y: 240, variant: 'runner', w: 120, h: 400 },
      standAt('column', 230, 320),
      standAt('column', 645, 320),
      standAt('column', 230, 560),
      standAt('column', 645, 560),
      // Benches by the front wall looking up the hall.
      against('bench', 's', 150, SCULPTURE),
      against('bench', 's', 725, SCULPTURE),
    ],
  },
  {
    // The artist talk: a Podium under a Screen, two rows of seats facing it.
    name: 'Talk Room',
    ...TALK,
    indoor: true,
    door: { side: 's', at: 250, sign: -1 },
    windows: [{ side: 'e', at: 400 }],
    pieces: [
      against('screen', 'n', 250, TALK),
      standAt('podium', 250, 190),
      ...chairRow([170, 250, 330], 370),
      ...chairRow([170, 250, 330], 580),
    ],
  },
  {
    // The foyer: the front desk, the visitors' board, and a café corner to talk the show over.
    name: 'Foyer',
    ...FOYER,
    indoor: true,
    door: { side: 's', at: FOYER.w / 2, sign: 1 },
    pieces: [
      standAt('reception-desk', 350, 300),
      against('notice-board', 'w', 300, FOYER, { notes: GALLERY_NOTES }),
      against('coat-rack', 's', 1000, FOYER),
      against('umbrella-stand', 's', 1070, FOYER),
      // The café: a bar along the right wall with its stools, coffee beside it, the drinks fridge on the front wall,
      // and Bean Bags to sit on.
      against('bar', 'e', 300, FOYER),
      ...[204, 268, 332, 396].map((y) => standAt('bar-stool', FOYER.w - 86, y, 'w')),
      against('coffee-machine', 'e', 520, FOYER),
      against('drinks-fridge', 's', 2280, FOYER),
      ...beanBags(1860, 300),
      standAt('directory', FOYER.w / 2 + 200, 540),
      against('plant', 'n', 60, FOYER),
      against('plant', 's', 60, FOYER),
    ],
  },
];

export function buildArtGallery(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: GALLERY_W,
    height: GALLERY_H,
    rooms: withSigns(galleryRooms()),
    // Each room's sign hangs inside it by its Door, as every Door opens onto the Foyer.
    signs: false,
    open: [],
    arrival: padAt(GALLERY_W, GALLERY_H, FOYER.x + FOYER.w / 2 - 120, FOYER.y + 320),
  });
}

// --- Wellness Studio ---------------------------------------------------------------

const WELL_NOTES: readonly TemplateNote[] = [
  {
    title: 'Class times',
    text: 'Yoga at the top of every hour in the Yoga Studio. The teacher starts the Timer.',
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

const YOGA = { x: 75, y: 75, w: 1125, h: 800 };
const MEDITATION = { x: besideX(YOGA), y: 75, w: 700, h: 800 };
const GYM = { x: besideX(MEDITATION), y: 75, w: 500, h: 800 };
const NAP = { x: 75, y: belowY(YOGA), w: 515, h: 600 };
const LOBBY = { x: besideX(NAP), y: NAP.y, w: GYM.x + GYM.w - besideX(NAP), h: 600 };
const WELL_W = LOBBY.x + LOBBY.w + 75;
const WELL_H = LOBBY.y + LOBBY.h + 75;

const wellRooms = (): IndoorRoom[] => [
  {
    // Four mats facing the teacher's, a Screen to follow, and a Timer for the class.
    name: 'Yoga Studio',
    ...YOGA,
    indoor: true,
    door: { side: 's', at: 680, sign: 1 },
    windows: [
      { side: 'w', at: 400 },
      { side: 'n', at: 250 },
    ],
    pieces: [
      against('screen', 'n', 562, YOGA),
      mat(518, 130),
      ...[200, 420, 640, 860].map((x) => mat(x, 420)),
      { kind: 'timer', x: 880, y: 60 },
      against('plant', 's', 60, YOGA),
      against('plant', 's', 1065, YOGA),
    ],
  },
  {
    // A fountain to listen to, bean bags round it facing in, plants in the corners.
    name: 'Meditation Room',
    ...MEDITATION,
    indoor: true,
    door: { side: 's', at: 350, sign: 1 },
    windows: [{ side: 'n', at: 350 }],
    pieces: [
      { kind: 'rug', x: 190, y: 260, variant: 'round', w: 320, h: 320 },
      standAt('fountain', 350, 420),
      standAt('bean-bag', 230, 330, 'w'),
      standAt('bean-bag', 470, 330, 'e'),
      standAt('bean-bag', 230, 510, 'w'),
      standAt('bean-bag', 470, 510, 'e'),
      against('plant', 'n', 60, MEDITATION),
      against('plant', 'n', 640, MEDITATION),
      against('plant', 's', 60, MEDITATION),
      against('plant', 's', 640, MEDITATION),
    ],
  },
  {
    // Treadmills facing the back wall, lockers on the side wall, water by the door.
    name: 'Gym',
    ...GYM,
    indoor: true,
    door: { side: 's', at: 250, sign: -1 },
    windows: [{ side: 'e', at: 400 }],
    pieces: [
      // Three treadmills side by side along the back wall.
      ...[170, 250, 330].map((x) => standAt('treadmill', x, 150, 's')),
      against('lockers', 'e', 560, GYM),
      against('water-cooler', 'w', 560, GYM),
    ],
  },
  {
    // Two Nap Pods and a reading nook, each a quiet place of its own.
    name: 'Nap Room',
    ...NAP,
    indoor: true,
    door: { side: 'e', at: 300, sign: 1 },
    windows: [{ side: 'w', at: 300 }],
    pieces: [
      standAt('nap-pod', 130, 140),
      standAt('nap-pod', 380, 140),
      { kind: 'rug', x: 120, y: 380 },
      against('reading-nook', 's', 220, NAP),
      against('plant', 's', 440, NAP),
    ],
  },
  {
    // The lobby: the front desk, the class board, and a juice bar.
    name: 'Lobby',
    ...LOBBY,
    indoor: true,
    door: { side: 's', at: 900, sign: 1 },
    pieces: [
      standAt('reception-desk', 400, 320),
      against('notice-board', 'w', 470, LOBBY, { notes: WELL_NOTES }),
      // Clear of the corner where the Yoga Studio's and the Meditation Room's walls meet the lobby's.
      against('bar', 'n', 460, LOBBY),
      ...[380, 440, 500, 560].map((x) => standAt('bar-stool', x, 126, 's')),
      against('drinks-fridge', 'n', 780, LOBBY),
      against('water-cooler', 'e', 200, LOBBY),
      standAt('hammock', 1300, 420),
      standAt('directory', 760, 520),
      against('plant', 's', 60, LOBBY),
      against('plant', 's', LOBBY.w - 60, LOBBY),
    ],
  },
];

export function buildWellnessStudio(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: WELL_W,
    height: WELL_H,
    rooms: withSigns(wellRooms()),
    // Each room's sign hangs inside it by its Door, as every Door opens onto the Lobby.
    signs: false,
    open: [],
    arrival: padAt(WELL_W, WELL_H, LOBBY.x + 900, LOBBY.y + 300),
  });
}
