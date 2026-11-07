// The Music Hall (docs/specs/012-collaboration/virtual-office-template.md "Venues"): a gig venue on one tab, closed rooms
// off a foyer (campusPlan, IndoorRoom) built and tested as the Campus Spaces are.
//
// - Main Hall: a Stage with Stage Curtains, two Screens and Bring Focus, a standing floor in front of the stage where
//   everyone arrives, and twenty chairs in two rows either side of a centre aisle up from the door.
// - Foyer Bar, Green Room and Cloakroom round the foyer, with four Columns, the Merch Stand and the Directory.
//
// Pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import { createShape, type Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import { campusPlan, type IndoorRoom } from './template-campus-parts';

const W = 2200;
const H = 1460;
const MID = W / 2;
const HALL = { x: 60, y: 60, w: 1120, h: 800 };

const seats = (xs: readonly number[], ys: readonly number[]): OfficePiece[] =>
  ys.flatMap((y) => xs.map((x) => ({ kind: 'chair' as const, x, y, facing: 's' as const })));

const ROOMS: IndoorRoom[] = [
  {
    name: 'Main Hall',
    ...HALL,
    indoor: true,
    door: { side: 's', at: 560, sign: 1 },
    pieces: [
      { kind: 'stage', x: 320, y: 48, w: 480, h: 150, stageCameras: true },
      { kind: 'stage-curtains', x: 320, y: 12, w: 480 },
      { kind: 'screen', x: 60, y: 44, w: 176 },
      { kind: 'screen', x: 900, y: 44, w: 176 },
      // The standing floor in front of the stage, then two rows of five either side of a 160 px aisle.
      ...seats([92, 170, 248, 326, 404], [460, 664]),
      ...seats([640, 718, 796, 874, 952], [460, 664]),
    ],
  },
  {
    name: 'Foyer Bar',
    x: 1260,
    y: 60,
    w: 880,
    h: 560,
    indoor: true,
    door: { side: 's', at: 120, sign: 1 },
    pieces: [
      { kind: 'jukebox', x: 40, y: 40 },
      { kind: 'drinks-fridge', x: 168, y: 36 },
      { kind: 'drinks-cabinet', x: 260, y: 40 },
      { kind: 'bar', x: 360, y: 40 },
      { kind: 'bar', x: 600, y: 40 },
      ...[380, 440, 500, 560, 620, 680, 740, 800].map((x) => ({
        kind: 'bar-stool' as const,
        x,
        y: 170,
      })),
      { kind: 'rug', x: 40, y: 300 },
      { kind: 'sofa', x: 64, y: 320, facing: 'n' },
      { kind: 'meeting-table', x: 560, y: 354 },
    ],
  },
  {
    name: 'Green Room',
    x: 1700,
    y: 700,
    w: 440,
    h: 400,
    indoor: true,
    door: { side: 'w', at: 200, sign: 1 },
    pieces: [
      { kind: 'water-cooler', x: 40, y: 40 },
      { kind: 'coffee-machine', x: 120, y: 50 },
      { kind: 'drinks-fridge', x: 220, y: 36 },
      { kind: 'plant', x: 360, y: 44 },
      { kind: 'rug', x: 180, y: 180 },
      { kind: 'chair', x: 120, y: 200, facing: 'e' },
      { kind: 'sofa', x: 204, y: 200, facing: 'n' },
    ],
  },
  {
    name: 'Cloakroom',
    x: 60,
    y: 960,
    w: 420,
    h: 380,
    indoor: true,
    door: { side: 'e', at: 190, sign: 1 },
    pieces: [
      { kind: 'coat-rack', x: 40, y: 60 },
      { kind: 'coat-rack', x: 110, y: 60 },
      { kind: 'lockers', x: 180, y: 44 },
      { kind: 'umbrella-stand', x: 40, y: 240 },
      { kind: 'plant', x: 340, y: 280 },
    ],
  },
];

const FOYER: OfficePiece[] = [
  // Two pairs of Columns either side of the way in.
  ...[880, 1260].flatMap((x) => [
    { kind: 'column' as const, x, y: 1060 },
    { kind: 'column' as const, x: x === 880 ? 760 : 1380, y: 1060 },
  ]),
  // The Merch Stand: a counter and the line-up on a Notice Board.
  { kind: 'notice-board', x: 1500, y: 1040 },
  { kind: 'reception-desk', x: 1480, y: 1180 },
  { kind: 'directory', x: MID + 80, y: 1300 },
  { kind: 'plant', x: 540, y: 1360 },
  { kind: 'plant', x: 1700, y: 1360 },
];

export function buildMusicHall(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: W,
    height: H,
    rooms: ROOMS,
    open: FOYER,
    title: {
      text: 'Music Hall',
      width: 240,
      sticker: 'emoji-music',
      subtitle:
        'Live music: the band on the stage, a standing floor and seats in the hall, and drinks in the foyer bar.',
    },
    // On the standing floor, in front of the stage.
    arrival: {
      dx: HALL.x + 560 - MID,
      dy: HALL.y + 320 - H / 2 - 12,
      hint: 'You arrive on the Avatar Pad in front of the stage. Whoever is on the stage is heard by the whole hall.',
    },
    extra: (left, top) => [createShape('focus-button', left + HALL.x + 880, top + HALL.y + 210)],
  });
}
