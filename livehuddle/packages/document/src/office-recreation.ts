// The social pieces' second set (docs/specs/009-elements/social-pieces.md "Pool Table, Foosball Table, Dartboard",
// "Vending Machine", "Bean Bag, Reading Nook"): drawings in the furniture's vocabulary (seating.ts), upright from the
// room's camera like the rest of the office, which both renderers paint (the editor's views and svg-render-faces).
// They join OFFICE_ART (office.ts). The seats and footprints are @liveworkspace/avatar's; where a lit piece glows on
// dark paper is named here (NIGHT_GLOW) for the editor's live layer. Pure: no React, no DOM.

import type { FurnitureDrawing, FurniturePart } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';
import {
  BEAN_BAG_SEATS,
  BEAN_BAG_SEATS_BACK,
  BEAN_BAG_SEATS_SIDE,
  READING_NOOK_SEATS,
  READING_NOOK_SEATS_BACK,
  READING_NOOK_SEATS_SIDE,
} from '@liveworkspace/avatar/seats';

// Fixed colours, as SOCIAL_TONES: wood, cloth, balls, the board's rings, the machine's paint and its lit glass.
export const RECREATION_TONES = {
  wood: '#c2894b',
  woodDeep: '#92400e',
  cloth: '#16a34a',
  cushion: '#166534',
  pocket: '#1c1917',
  sight: '#fde68a',
  cue: '#e7c58b',
  chalk: '#38bdf8',
  ballWhite: '#f8fafc',
  ballYellow: '#facc15',
  ballRed: '#dc2626',
  ballBlue: '#2563eb',
  ballPurple: '#7c3aed',
  ballOrange: '#f97316',
  ballBlack: '#111827',
  pitch: '#22c55e',
  handle: '#475569',
  teamRed: '#dc2626',
  teamBlue: '#2563eb',
  brass: '#e0b232',
  sisal: '#1c1917',
  cream: '#f5e6c8',
  boardRed: '#dc2626',
  boardGreen: '#15803d',
  flightA: '#f97316',
  flightB: '#22d3ee',
  flightC: '#a3e635',
  vending: '#0f766e',
  vendingDeep: '#115e59',
  sign: '#fbbf24',
  glass: '#ecfeff',
  display: '#4ade80',
  keypad: '#cbd5e1',
  slot: '#0f172a',
  cans: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#ec4899'],
  bag: '#fb7185',
  bagDeep: '#f43f5e',
  armchair: '#d97706',
  cushionLight: '#fbbf24',
  rug: '#e9a27c',
  iron: '#374151',
  shade: '#fde68a',
  bookRed: '#ef4444',
  bookBlue: '#3b82f6',
  bookYellow: '#facc15',
} as const;

const T = RECREATION_TONES;

const r2 = (v: number) => Math.round(v * 100) / 100;

// A circle as one closed path, so several share one part (and one fill).
const circleD = (cx: number, cy: number, r: number) =>
  `M${r2(cx - r)} ${r2(cy)}a${r} ${r} 0 1 0 ${r2(2 * r)} 0a${r} ${r} 0 1 0 ${r2(-2 * r)} 0Z`;

// --- The games corner -----------------------------------------------------------------------------------------

// Six pockets at the cloth's corners and the middle of each long side.
const POCKETS = [
  [19, 30],
  [100, 28.5],
  [181, 30],
  [19, 74],
  [100, 75.5],
  [181, 74],
] as const;

// The racked triangle, apex toward the cue ball, the black in the middle of the back row.
const RACK: readonly [number, number, string][] = [
  [132, 52, T.ballYellow],
  [138.4, 48.6, T.ballRed],
  [138.4, 55.4, T.ballBlue],
  [144.8, 45.2, T.ballPurple],
  [144.8, 52, T.ballBlack],
  [144.8, 58.8, T.ballOrange],
];

// A wooden table on two stout legs, green cloth inside its cushions, six pockets, the rack, the cue ball and a cue.
const POOL_TABLE_VIEW: FurnitureDrawing = {
  width: 200,
  height: 128,
  parts: [
    ellipse('shadow', 100, 124, 94, 4),
    rect('panel', 18, 84, 14, 34, 4, T.woodDeep),
    rect('panel', 168, 84, 14, 34, 4, T.woodDeep),
    rect('panel', 14, 114, 22, 6, 2, T.woodDeep),
    rect('panel', 164, 114, 22, 6, 2, T.woodDeep),
    rect('panel', 6, 20, 188, 64, 10, T.wood),
    path(
      'mark',
      'M50 22.4l1.6 1.6l-1.6 1.6l-1.6-1.6zM75 22.4l1.6 1.6l-1.6 1.6l-1.6-1.6zM125 22.4l1.6 1.6l-1.6 1.6l-1.6-1.6zM150 22.4l1.6 1.6l-1.6 1.6l-1.6-1.6z',
      T.sight,
    ),
    rect('panel', 16, 28, 168, 48, 4, T.cushion),
    rect('mark', 20, 31, 160, 42, 2, T.cloth),
    path('rail', 'M58 33V71'),
    path('mark', POCKETS.map(([x, y]) => circleD(x, y, 4)).join(''), T.pocket),
    ...RACK.map(([x, y, fill]) => ellipse('mark', x, y, 3.4, 3.4, fill)),
    ellipse('mark', 62, 52, 3.4, 3.4, T.ballWhite),
    path('glint', 'M131 50.4h1.2M137.4 47h1.2M60.8 50.4h1.2'),
    path('mark', 'M26 70L112 41L113 43.4L27 72.6Z', T.cue),
    path('mark', 'M26 70L44 63.9L45 66.4L27 72.6Z', T.woodDeep),
    ellipse('mark', 112.6, 42.2, 1.3, 1.3, T.chalk),
    rect('face', 6, 80, 188, 10, 4, T.wood),
  ],
  seats: [],
  ring: { cx: 100, cy: 52, rx: 96, ry: 40 },
};

// The cloth's contents laid out by `at`, which takes a spot on the front drawing to where a turned drawing shows it:
// the pockets, the rack with its apex toward the cue ball, the cue ball and the cue across the cloth, each ball's
// glint up and left (the light is the room's, not the table's). The pockets are a set a half turn leaves as it is.
type At = (x: number, y: number) => readonly [number, number];
function poolCloth(at: At): FurniturePart[] {
  const pt = (x: number, y: number) => at(x, y).map(r2).join(' ');
  const ball = (x: number, y: number, fill: string) => {
    const [cx, cy] = at(x, y);
    return ellipse('mark', r2(cx), r2(cy), 3.4, 3.4, fill);
  };
  const glint = (x: number, y: number) => {
    const [cx, cy] = at(x, y);
    return `M${r2(cx - 1)} ${r2(cy - 1.6)}h1.2`;
  };
  return [
    path('mark', POCKETS.map(([x, y]) => circleD(...at(x, y), 4)).join(''), T.pocket),
    ...RACK.map(([x, y, fill]) => ball(x, y, fill)),
    ball(62, 52, T.ballWhite),
    path('glint', glint(132, 52) + glint(138.4, 48.6) + glint(62, 52)),
    path('mark', `M${pt(26, 70)}L${pt(112, 41)}L${pt(113, 43.4)}L${pt(27, 72.6)}Z`, T.cue),
    path('mark', `M${pt(26, 70)}L${pt(44, 63.9)}L${pt(45, 66.4)}L${pt(27, 72.6)}Z`, T.woodDeep),
    ellipse('mark', ...(at(112.6, 42.2).map(r2) as [number, number]), 1.3, 1.3, T.chalk),
  ];
}

// From behind: the same table, its cloth turned half way round, so the rack is on the left and the cue ball on the
// right; the sights stay on the far rail.
const POOL_TABLE_BACK: FurnitureDrawing = {
  ...POOL_TABLE_VIEW,
  parts: [
    ...POOL_TABLE_VIEW.parts.slice(0, 9),
    path('rail', 'M142 33V71'),
    ...poolCloth((x, y) => [200 - x, 104 - y]),
    rect('face', 6, 80, 188, 10, 4, T.wood),
  ],
};

// Facing left: long and narrow, its length down the canvas, the head string and the cue ball at the far end, the
// rack nearest you; the sights along the far rail on the right, a strip of the near rail's face down the left, and
// the pedestal under its near end.
const POOL_SIDE_X = 46;
const POOL_TABLE_SIDE: FurnitureDrawing = {
  width: 88,
  height: 240,
  parts: [
    ellipse('shadow', 44, 236, 40, 4),
    rect('panel', 26, 200, 36, 30, 4, T.woodDeep),
    rect('panel', 20, 226, 48, 6, 2, T.woodDeep),
    rect('face', 3, 14, 12, 186, 4, T.wood),
    rect('panel', 8, 8, 76, 192, 10, T.wood),
    path(
      'mark',
      [52.13, 78.06, 129.94, 155.88]
        .map((y) => `M79 ${r2(y - 1.6)}l1.6 1.6l-1.6 1.6l-1.6-1.6z`)
        .join(''),
      T.sight,
    ),
    rect('panel', 18, 18, 56, 172, 4, T.cushion),
    rect('mark', 21, 21, 50, 166, 2, T.cloth),
    path('rail', 'M23 60.43H69'),
    ...poolCloth((x, y) => [POOL_SIDE_X + ((52 - y) * 50) / 42, 104 + ((x - 100) * 166) / 160]),
    rect('face', 8, 196, 76, 10, 4, T.wood),
  ],
  seats: [],
  ring: { cx: 46, cy: 104, rx: 42, ry: 100 },
};

// The rods, left to right, and where their players stand: a red goalie, three blue, three red, a blue goalie.
const FOOS_RODS = [40, 66, 102, 128] as const;
const FOOS_PLAYERS: readonly (readonly number[])[] = [[47], [35, 47, 59], [35, 47, 59], [47]];
const foosPlayers = (rods: readonly number[]) =>
  rods
    .flatMap((i) =>
      FOOS_PLAYERS[i]!.map((y) => {
        const x = FOOS_RODS[i]!;
        return `M${x - 3} ${y - 3}h6v8h-6zM${x - 1.8} ${y - 4.6}a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0Z`;
      }),
    )
    .join('');

// A wooden cabinet round a green pitch, a goal at each end, four rods with their players and handles, the ball.
const FOOSBALL_TABLE_VIEW: FurnitureDrawing = {
  width: 168,
  height: 104,
  parts: [
    ellipse('shadow', 84, 100, 76, 3),
    rect('panel', 18, 70, 12, 28, 3, T.woodDeep),
    rect('panel', 138, 70, 12, 28, 3, T.woodDeep),
    rect('panel', 10, 22, 148, 50, 5, T.wood),
    rect('mark', 18, 28, 132, 38, 2, T.pitch),
    rect('mark', 83.3, 28, 1.4, 38, 0, T.ballWhite),
    path('glint', 'M77 47a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M18 39h8v16h-8M150 39h-8v16h8'),
    path('mark', 'M13 41h5v12h-5zM150 41h5v12h-5z', T.pocket),
    ellipse('mark', 84, 47, 2.2, 2.2, T.ballWhite),
    rect('face', 10, 70, 148, 8, 3, T.wood),
    path('line', FOOS_RODS.map((x) => `M${x} 16V84`).join('')),
    path('mark', foosPlayers([0, 2]), T.teamRed),
    path('mark', foosPlayers([1, 3]), T.teamBlue),
    path('panel', FOOS_RODS.map((x) => `M${x - 2.5} 82h5v9h-5z`).join(''), T.handle),
  ],
  seats: [],
  ring: { cx: 84, cy: 47, rx: 80, ry: 34 },
};

// Players stood upright at each spot, as foosPlayers draws them.
const playersAt = (spots: readonly (readonly [number, number])[]) =>
  spots
    .map(
      ([x, y]) =>
        `M${x - 3} ${y - 3}h6v8h-6zM${x - 1.8} ${y - 4.6}a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0Z`,
    )
    .join('');

// From behind: the same cabinet turned half way round, so each team's rods are at the other end; the handles are
// the other side's, on the near side again.
const FOOSBALL_TABLE_BACK: FurnitureDrawing = {
  ...FOOSBALL_TABLE_VIEW,
  parts: [
    ...FOOSBALL_TABLE_VIEW.parts.slice(0, 11),
    path('mark', foosPlayers([1, 3]), T.teamRed),
    path('mark', foosPlayers([0, 2]), T.teamBlue),
    FOOSBALL_TABLE_VIEW.parts[13]!,
  ],
};

// Facing left: the pitch down the canvas, a goal at its top and its foot, the rods across it with their handles out
// to the left (the players' side), a strip of the cabinet's near face down the left, two legs under the near end.
const FOOS_SIDE_RODS = FOOS_RODS.map((x) => x - 2);
const foosSidePlayers = (rods: readonly number[]) =>
  playersAt(
    rods.flatMap((i) => FOOS_PLAYERS[i]!.map((y) => [49 - (y - 47), FOOS_SIDE_RODS[i]!] as const)),
  );
const FOOSBALL_TABLE_SIDE: FurnitureDrawing = {
  width: 84,
  height: 190,
  parts: [
    ellipse('shadow', 47, 184, 34, 3),
    rect('panel', 28, 156, 10, 26, 3, T.woodDeep),
    rect('panel', 60, 156, 10, 26, 3, T.woodDeep),
    rect('face', 20, 12, 10, 144, 3, T.wood),
    rect('panel', 24, 8, 50, 148, 5, T.wood),
    rect('mark', 30, 16, 38, 132, 2, T.pitch),
    rect('mark', 30, 81.3, 38, 1.4, 0, T.ballWhite),
    path('glint', 'M42 82a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M41 16v8h16v-8M41 148v-8h16v8'),
    path('mark', 'M43 11h12v5h-12zM43 148h12v5h-12z', T.pocket),
    ellipse('mark', 49, 82, 2.2, 2.2, T.ballWhite),
    rect('face', 24, 154, 50, 8, 3, T.wood),
    path('line', FOOS_SIDE_RODS.map((y) => `M12 ${y}H80`).join('')),
    path('mark', foosSidePlayers([0, 2]), T.teamRed),
    path('mark', foosSidePlayers([1, 3]), T.teamBlue),
    path('panel', FOOS_SIDE_RODS.map((y) => `M5 ${y - 2.5}h9v5h-9z`).join(''), T.handle),
  ],
  seats: [],
  ring: { cx: 49, cy: 82, rx: 40, ry: 80 },
};

/** The dartboard's centre on its grid. */
const BOARD = { cx: 40, cy: 50 } as const;

// Ten of the board's twenty segments as one path, out to radius r: the even ones (20 at the top, black) or the odd.
function segments(r: number, odd: boolean): string {
  let d = '';
  for (let i = odd ? 1 : 0; i < 20; i += 2) {
    const a0 = ((-90 + i * 18 - 9) * Math.PI) / 180;
    const a1 = ((-90 + i * 18 + 9) * Math.PI) / 180;
    const x0 = r2(BOARD.cx + Math.cos(a0) * r);
    const y0 = r2(BOARD.cy + Math.sin(a0) * r);
    const x1 = r2(BOARD.cx + Math.cos(a1) * r);
    const y1 = r2(BOARD.cy + Math.sin(a1) * r);
    d += `M${BOARD.cx} ${BOARD.cy}L${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}Z`;
  }
  return d;
}

// A dart stuck in at (x, y): its shaft toward the viewer, up and right, and its flight.
const dart = (x: number, y: number, flight: string): FurniturePart[] => [
  path('line', `M${x} ${y}l7 -7`),
  path('mark', `M${x + 7} ${y - 7}l7 -1l-3 -2zM${x + 7} ${y - 7}l1 -7l2 3z`, flight),
];

// A round board on a wooden backboard, hung from a nail: the segments, the double and treble rings, the bull and
// three darts. Painted ring by ring: each ring's red disc and green segments, then the board inside it again.
const DARTBOARD_VIEW: FurnitureDrawing = {
  width: 80,
  height: 96,
  parts: [
    path('line', 'M26 14L40 4L54 14'),
    ellipse('panel', 40, 4, 2.5, 2.5, T.brass),
    rect('panel', 2, 12, 76, 78, 8, T.woodDeep),
    ellipse('panel', BOARD.cx, BOARD.cy, 34, 34, T.sisal),
    ellipse('mark', BOARD.cx, BOARD.cy, 28, 28, T.boardRed),
    path('mark', segments(28, true), T.boardGreen),
    ellipse('mark', BOARD.cx, BOARD.cy, 25.5, 25.5, T.cream),
    path('mark', segments(25.5, false), T.sisal),
    ellipse('mark', BOARD.cx, BOARD.cy, 17, 17, T.boardRed),
    path('mark', segments(17, true), T.boardGreen),
    ellipse('mark', BOARD.cx, BOARD.cy, 14.5, 14.5, T.cream),
    path('mark', segments(14.5, false), T.sisal),
    ellipse('mark', BOARD.cx, BOARD.cy, 4.5, 4.5, T.boardGreen),
    ellipse('mark', BOARD.cx, BOARD.cy, 2, 2, T.boardRed),
    ...dart(43, 35, T.flightA),
    ...dart(52, 54, T.flightB),
    ...dart(33, 60, T.flightC),
  ],
  seats: [],
  ring: { cx: 40, cy: 50, rx: 38, ry: 38 },
};

// --- The break room -------------------------------------------------------------------------------------------

// The window's five shelves of cans, three a shelf, each colour one part.
const SHELVES = [36, 50, 64, 78, 92] as const;
function cans(): FurniturePart[] {
  const byColour = new Map<string, string>();
  SHELVES.forEach((bottom, row) => {
    for (let i = 0; i < 3; i += 1) {
      const fill = T.cans[(i + row * 2) % T.cans.length]!;
      byColour.set(fill, `${byColour.get(fill) ?? ''}M${12 + i * 12} ${bottom - 10}h9v10h-9z`);
    }
  });
  return [...byColour].map(([fill, d]) => path('mark', d, fill));
}

// A tall teal cabinet: a lit sign, a glass window of cans on five shelves, a side panel with a display, a keypad and a
// coin slot, a pickup flap.
const VENDING_MACHINE_VIEW: FurnitureDrawing = {
  width: 72,
  height: 128,
  parts: [
    ellipse('shadow', 36, 125, 33, 3),
    rect('panel', 4, 4, 64, 118, 5, T.vending),
    rect('panel', 8, 8, 56, 11, 2, T.sign),
    path('glint', 'M12 12h14'),
    rect('panel', 8, 23, 41, 74, 3, T.glass),
    ...cans(),
    path('rail', SHELVES.map((y) => `M10 ${y}h37`).join('')),
    path('glint', 'M14 92L30 26'),
    rect('face', 52, 23, 12, 74, 2, T.vendingDeep),
    rect('mark', 54, 27, 8, 5, 1, T.display),
    path(
      'mark',
      [36, 39.5, 43]
        .map((y) => [54.5, 57.5, 60.5].map((x) => `M${x - 1} ${y}h2v2h-2z`).join(''))
        .join(''),
      T.keypad,
    ),
    rect('mark', 57, 52, 2, 7, 1, T.slot),
    rect('face', 10, 102, 38, 13, 2, T.vendingDeep),
    path('rail', 'M14 106h30'),
    rect('panel', 2, 116, 68, 8, 3, T.vendingDeep),
  ],
  seats: [],
  ring: { cx: 36, cy: 116, rx: 34, ry: 8 },
};

// Its back to you: the cabinet's plain back with a vented panel and its power cord, the sign's lit edge along the top.
const VENDING_MACHINE_BACK: FurnitureDrawing = {
  width: 72,
  height: 128,
  parts: [
    ellipse('shadow', 36, 125, 33, 3),
    rect('panel', 4, 4, 64, 118, 5, T.vending),
    rect('panel', 10, 4, 52, 3, 1.5, T.sign),
    rect('face', 12, 16, 48, 92, 3, T.vendingDeep),
    path('rail', 'M20 26h32M20 31h32M20 36h32M20 41h32'),
    ellipse('panel', 48, 96, 3, 3, T.keypad),
    path('line', 'M48 99c0 10 6 14 14 18'),
    rect('panel', 2, 116, 68, 8, 3, T.vendingDeep),
  ],
  seats: [],
  ring: { cx: 36, cy: 116, rx: 34, ry: 8 },
};

// Facing left: the cabinet's tall side toward you with a stripe down it, its front a narrow strip down the left: the
// lit sign's edge, the glass with a column of cans behind it, the pickup flap.
const VENDING_MACHINE_SIDE: FurnitureDrawing = {
  width: 60,
  height: 128,
  parts: [
    ellipse('shadow', 30, 125, 28, 3),
    rect('panel', 14, 4, 42, 118, 5, T.vending),
    rect('face', 22, 14, 8, 98, 3, T.vendingDeep),
    rect('panel', 4, 6, 12, 116, 3, T.vending),
    rect('panel', 6, 8, 8, 11, 2, T.sign),
    rect('panel', 6, 23, 8, 74, 2, T.glass),
    ...SHELVES.map((bottom, row) =>
      path('mark', `M8 ${bottom - 10}h4v10h-4z`, T.cans[(row * 2) % T.cans.length]),
    ),
    path('rail', SHELVES.map((y) => `M7 ${y}h6`).join('')),
    path('glint', 'M9 90L12 30'),
    rect('face', 6, 102, 8, 13, 2, T.vendingDeep),
    rect('panel', 2, 116, 56, 8, 3, T.vendingDeep),
  ],
  seats: [],
  ring: { cx: 30, cy: 116, rx: 28, ry: 8 },
};

// --- Breakout seating -----------------------------------------------------------------------------------------

// A slouchy bean bag, the hollow a sitter sinks into, its seams.
const BEAN_BAG_VIEW: FurnitureDrawing = {
  width: BEAN_BAG_SEATS.width,
  height: BEAN_BAG_SEATS.height,
  parts: [
    ellipse('shadow', 32, 52, 28, 3),
    path(
      'panel',
      'M5 47C1 39 5 27 15 22C20 14 27 11 33 13C38 10 46 14 49 22C59 27 63 39 59 47C55 54 9 54 5 47Z',
      T.bag,
    ),
    ellipse('mark', 32, 35, 16, 7, T.bagDeep),
    path('rail', 'M15 23C19 31 19 41 16 50M49 23C45 31 45 41 48 50M22 17C26 22 30 21 33 15'),
    path('glint', 'M13 28C15 22 18 19 22 17'),
  ],
  seats: BEAN_BAG_SEATS.seats.map(({ u, v }) => ({ u, v })),
  // Round the rim of the hollow, wider than a sitter, so it shows either side of them.
  ring: { cx: 32, cy: 40, rx: 27, ry: 9 },
  ringUnder: 2,
};

// From behind: its raised back nearest you, the hollow a sitter sinks into beyond it.
const BEAN_BAG_BACK: FurnitureDrawing = {
  ...BEAN_BAG_SEATS_BACK,
  parts: [
    ellipse('shadow', 32, 52, 28, 3),
    path(
      'panel',
      'M5 47C2 39 6 28 14 23C20 17 27 15 32 15C38 15 45 17 50 23C58 28 62 39 59 47C55 54 9 54 5 47Z',
      T.bag,
    ),
    ellipse('mark', 32, 25, 14, 5.5, T.bagDeep),
    path('face', 'M7 46C6 36 17 29 32 29C47 29 58 36 57 46C53 53 11 53 7 46Z', T.bag),
    path('rail', 'M18 31C21 37 21 44 19 50M46 31C43 37 43 44 45 50M32 29V51'),
    path('glint', 'M12 40C14 35 18 32 23 31'),
  ],
  ring: { cx: 32, cy: 25, rx: 21, ry: 7 },
  ringUnder: 3,
};

// Facing left: the hollow toward the left, its back rising on the right.
const BEAN_BAG_SIDE: FurnitureDrawing = {
  ...BEAN_BAG_SEATS_SIDE,
  parts: [
    ellipse('shadow', 32, 52, 28, 3),
    path(
      'panel',
      'M5 47C1 40 4 30 12 26C17 21 23 19 29 21C33 13 42 9 50 13C58 18 63 34 59 47C55 54 9 54 5 47Z',
      T.bag,
    ),
    ellipse('mark', 25, 36, 13, 6.5, T.bagDeep),
    path('rail', 'M42 15C46 25 45 39 43 51M13 27C16 34 16 42 14 50'),
    path('glint', 'M36 18C40 14 45 13 49 15'),
  ],
  ring: { cx: 27, cy: 40, rx: 23, ry: 8 },
  ringUnder: 2,
};

// A wingback armchair on a round rug, a side table with a stack of books, and a floor lamp with its shade lit.
const READING_NOOK_VIEW: FurnitureDrawing = {
  width: READING_NOOK_SEATS.width,
  height: READING_NOOK_SEATS.height,
  parts: [
    ellipse('panel', 80, 92, 76, 16, T.rug),
    ellipse('rail', 80, 92, 66, 11),
    ellipse('panel', 136, 96, 9, 3, T.iron),
    path('line', 'M136 95V32'),
    path('panel', 'M124 34L128 14H144L148 34Z', T.shade),
    path('rail', 'M125.5 28H146.5'),
    path('panel', 'M42 62V30C42 19 50 13 60 13H92C102 13 110 19 110 30V62Z', T.armchair),
    path('rail', 'M60 24v26M76 22v28M92 24v26'),
    rect('panel', 48, 52, 56, 18, 5, T.cushionLight),
    rect('panel', 36, 42, 15, 38, 6, T.armchair),
    rect('panel', 101, 42, 15, 38, 6, T.armchair),
    rect('face', 48, 68, 56, 12, 3, T.armchair),
    path('line', 'M42 80v8M110 80v8'),
    path('line', 'M18 72V92'),
    ellipse('panel', 18, 93, 8, 2.5, T.woodDeep),
    ellipse('panel', 18, 68, 14, 4.5, T.wood),
    rect('panel', 9, 58, 18, 5, 1.5, T.bookRed),
    rect('panel', 11, 53, 15, 5, 1.5, T.bookBlue),
    rect('panel', 10, 48, 16, 5, 1.5, T.bookYellow),
  ],
  seats: READING_NOOK_SEATS.seats.map(({ u, v }) => ({ u, v })),
  // Across the cushion's front and the arms' feet, so it shows either side of a sitter.
  ring: { cx: 76, cy: 74, rx: 34, ry: 8 },
  ringUnder: 12,
};

// Its back to you: the set mirrored (the lamp on the left, the side table on the right), the armchair's wingback back
// nearest you over its cushion and arms.
const READING_NOOK_BACK: FurnitureDrawing = {
  ...READING_NOOK_SEATS_BACK,
  parts: [
    ellipse('panel', 80, 92, 76, 16, T.rug),
    ellipse('rail', 80, 92, 66, 11),
    ellipse('panel', 24, 96, 9, 3, T.iron),
    path('line', 'M24 95V32'),
    path('panel', 'M12 34L16 14H32L36 34Z', T.shade),
    path('rail', 'M13.5 28H34.5'),
    path('line', 'M142 72V92'),
    ellipse('panel', 142, 93, 8, 2.5, T.woodDeep),
    ellipse('panel', 142, 68, 14, 4.5, T.wood),
    rect('panel', 133, 58, 18, 5, 1.5, T.bookRed),
    rect('panel', 134, 53, 15, 5, 1.5, T.bookBlue),
    rect('panel', 134, 48, 16, 5, 1.5, T.bookYellow),
    rect('panel', 44, 30, 15, 42, 6, T.armchair),
    rect('panel', 109, 30, 15, 42, 6, T.armchair),
    rect('panel', 56, 28, 56, 16, 5, T.cushionLight),
    path('line', 'M54 84v6M114 84v6'),
    path('face', 'M50 86V50C50 40 58 34 68 34H100C110 34 118 40 118 50V86Z', T.armchair),
    path('rail', 'M68 44v34M84 42v36M100 44v34'),
  ],
  ring: { cx: 84, cy: 38, rx: 34, ry: 8 },
  ringUnder: 16,
};

// Facing left: the armchair in the middle of the rug, its cushion seen from above between its two arms, its wingback
// a tall bar along its right and its seat's front a strip down its left; the side table with its books beyond it and
// the lit lamp nearer you.
const READING_NOOK_SIDE: FurnitureDrawing = {
  ...READING_NOOK_SEATS_SIDE,
  parts: [
    ellipse('panel', 56, 96, 46, 54, T.rug),
    ellipse('rail', 56, 96, 39, 46),
    path('line', 'M30 44V62'),
    ellipse('panel', 30, 63, 8, 2.5, T.woodDeep),
    ellipse('panel', 30, 40, 14, 4.5, T.wood),
    rect('panel', 21, 30, 18, 5, 1.5, T.bookRed),
    rect('panel', 23, 25, 15, 5, 1.5, T.bookBlue),
    rect('panel', 22, 20, 16, 5, 1.5, T.bookYellow),
    path('line', 'M38 118v8M86 118v8'),
    rect('panel', 80, 52, 18, 68, 7, T.armchair),
    path('rail', 'M89 62v48'),
    rect('panel', 36, 62, 50, 14, 6, T.armchair),
    rect('face', 32, 74, 8, 32, 3, T.armchair),
    rect('panel', 38, 74, 44, 32, 5, T.cushionLight),
    rect('panel', 36, 102, 50, 14, 6, T.armchair),
    rect('face', 36, 112, 50, 7, 3, T.armchair),
    ellipse('panel', 18, 140, 9, 3, T.iron),
    path('line', 'M18 139V96'),
    path('panel', 'M6 98L10 78H26L30 98Z', T.shade),
    path('rail', 'M7.5 92H28.5'),
  ],
  ring: { cx: 60, cy: 92, rx: 24, ry: 14 },
  ringUnder: 14,
};

/** The grid pieces this module draws, for OFFICE_ART. */
export const OFFICE_RECREATION_ART = {
  'pool-table': { front: POOL_TABLE_VIEW, back: POOL_TABLE_BACK, side: POOL_TABLE_SIDE },
  'foosball-table': {
    front: FOOSBALL_TABLE_VIEW,
    back: FOOSBALL_TABLE_BACK,
    side: FOOSBALL_TABLE_SIDE,
  },
  dartboard: allSides(DARTBOARD_VIEW),
  'vending-machine': {
    front: VENDING_MACHINE_VIEW,
    back: VENDING_MACHINE_BACK,
    side: VENDING_MACHINE_SIDE,
  },
  'bean-bag': { front: BEAN_BAG_VIEW, back: BEAN_BAG_BACK, side: BEAN_BAG_SIDE },
  'reading-nook': { front: READING_NOOK_VIEW, back: READING_NOOK_BACK, side: READING_NOOK_SIDE },
} as const;

type GlowEllipse = { cx: number; cy: number; rx: number; ry: number };

/**
 * Where a lit piece glows on dark paper, on its grid (social-pieces.md "Vending Machine", "Reading Nook"): a pool of
 * light on the floor and a halo round what is lit, in the light's colour.
 */
export const NIGHT_GLOW: Readonly<
  Record<
    'vending-machine' | 'reading-nook',
    { color: string; pool: GlowEllipse; halo: GlowEllipse }
  >
> = {
  'vending-machine': {
    color: '#a5f3fc',
    pool: { cx: 36, cy: 126, rx: 46, ry: 10 },
    halo: { cx: 28.5, cy: 60, rx: 30, ry: 46 },
  },
  'reading-nook': {
    color: '#fde68a',
    pool: { cx: 132, cy: 96, rx: 36, ry: 11 },
    halo: { cx: 136, cy: 25, rx: 22, ry: 17 },
  },
};

type NightGlow = (typeof NIGHT_GLOW)[keyof typeof NIGHT_GLOW];

// The same lights on the turned drawings: the vending machine's window shows only on its side (a strip down its
// left, its light spilling left), never from behind; the reading nook's lamp is lit from every side.
const NIGHT_GLOW_TURNED: Readonly<
  Record<keyof typeof NIGHT_GLOW, { back: NightGlow | null; side: NightGlow }>
> = {
  'vending-machine': {
    back: null,
    side: {
      color: '#a5f3fc',
      pool: { cx: 6, cy: 124, rx: 26, ry: 8 },
      halo: { cx: 10, cy: 60, rx: 14, ry: 44 },
    },
  },
  'reading-nook': {
    back: {
      color: '#fde68a',
      pool: { cx: 28, cy: 96, rx: 36, ry: 11 },
      halo: { cx: 24, cy: 25, rx: 22, ry: 17 },
    },
    side: {
      color: '#fde68a',
      pool: { cx: 22, cy: 140, rx: 30, ry: 10 },
      halo: { cx: 18, cy: 88, rx: 22, ry: 17 },
    },
  },
};

/** A lit piece's glow on the drawing a facing shows, on that drawing's grid, or null where its light is out of sight. */
export function nightGlowIn(
  kind: keyof typeof NIGHT_GLOW,
  view: 'front' | 'back' | 'side',
): NightGlow | null {
  return view === 'front' ? NIGHT_GLOW[kind] : NIGHT_GLOW_TURNED[kind][view];
}

/** Whether a kind glows on dark paper. */
export function glowsAtNight(kind: string): kind is keyof typeof NIGHT_GLOW {
  return kind === 'vending-machine' || kind === 'reading-nook';
}
