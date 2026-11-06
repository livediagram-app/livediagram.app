// The social pieces' second set (docs/specs/009-elements/social-pieces.md "Pool Table, Foosball Table, Dartboard",
// "Vending Machine", "Bean Bag, Reading Nook"): drawings in the furniture's vocabulary (seating.ts), upright from the
// room's camera like the rest of the office, which both renderers paint (the editor's views and svg-render-faces).
// They join OFFICE_ART (office.ts). The seats and footprints are @liveworkspace/avatar's; where a lit piece glows on
// dark paper is named here (NIGHT_GLOW) for the editor's live layer. Pure: no React, no DOM.

import type { FurnitureDrawing, FurniturePart } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';
import { BEAN_BAG_SEATS, READING_NOOK_SEATS } from '@liveworkspace/avatar/seats';

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
  ring: { cx: 32, cy: 34, rx: 18, ry: 8 },
  ringUnder: 3,
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
  ring: { cx: 76, cy: 62, rx: 26, ry: 8 },
  ringUnder: 9,
};

/** The grid pieces this module draws, for OFFICE_ART. */
export const OFFICE_RECREATION_ART = {
  'pool-table': allSides(POOL_TABLE_VIEW),
  'foosball-table': allSides(FOOSBALL_TABLE_VIEW),
  dartboard: allSides(DARTBOARD_VIEW),
  'vending-machine': allSides(VENDING_MACHINE_VIEW),
  'bean-bag': allSides(BEAN_BAG_VIEW),
  'reading-nook': allSides(READING_NOOK_VIEW),
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

/** Whether a kind glows on dark paper. */
export function glowsAtNight(kind: string): kind is keyof typeof NIGHT_GLOW {
  return kind === 'vending-machine' || kind === 'reading-nook';
}
