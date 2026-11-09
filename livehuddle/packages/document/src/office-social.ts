// The social pieces (docs/specs/009-elements/social-pieces.md): the Notice Board, World Clock, Jukebox, Ping-Pong
// Table, Arcade Machine, Fireplace, Campfire, Bench, Picnic Table, Hammock, Garden Umbrella, Fountain and Pond. Their
// drawings are tables of parts in the furniture's vocabulary (seating.ts), drawn upright from the room's camera like
// the rest of the office, which both renderers paint (the editor's views and svg-render-faces). The grid pieces join
// OFFICE_ART (office.ts); the pond is drawn to its own size, as grass is. The notes a notice board holds, the zones a
// world clock shows and a jukebox's source are element fields, bounded and checked here. The geometry the walk needs
// (the seats, the footprints) is @livehuddle/avatar's. Pure: no React, no DOM.

import type { FurnitureDrawing, FurniturePart } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';
import {
  BENCH_SEATS,
  BENCH_SEATS_BACK,
  BENCH_SEATS_SIDE,
  HAMMOCK_SEATS,
  HAMMOCK_SEATS_SIDE,
  PICNIC_TABLE_SEATS,
  PICNIC_TABLE_SEATS_BACK,
  PICNIC_TABLE_SEATS_SIDE,
  PING_PONG_SEATS,
  PING_PONG_SEATS_BACK,
  PING_PONG_SEATS_SIDE,
} from '@livehuddle/avatar/seats';

// Fixed colours for what keeps its colour whatever the theme, as OFFICE_TONES: cork, wood, brick, stone, fire, water,
// felt, chrome and lights. Outlines stay the theme's stroke.
export const SOCIAL_TONES = {
  cork: '#d9a866',
  frame: '#8b5a2b',
  brass: '#e0b232',
  wood: '#c2894b',
  woodDeep: '#92400e',
  bark: '#a16207',
  brick: '#c2593a',
  brickDeep: '#9a3412',
  soot: '#292524',
  stone: '#e7e5e4',
  stoneDeep: '#a8a29e',
  iron: '#374151',
  flame: '#f97316',
  flameHot: '#facc15',
  ember: '#ef4444',
  water: '#7dd3fc',
  waterDeep: '#38bdf8',
  lily: '#4ade80',
  lilyDeep: '#16a34a',
  felt: '#16a34a',
  feltDeep: '#166534',
  line: '#f8fafc',
  paddleRed: '#dc2626',
  paddleDark: '#1f2937',
  cabinet: '#6366f1',
  cabinetDeep: '#4338ca',
  screen: '#0f172a',
  jukebox: '#be123c',
  jukeboxDeep: '#881337',
  chrome: '#e2e8f0',
  glow: '#fbbf24',
  record: '#1f2937',
  canvas: '#ffffff',
  stripe: '#ef4444',
  hammock: '#38bdf8',
  hammockBand: '#fb923c',
  pink: '#f472b6',
  dial: '#fffbeb',
  yellow: '#facc15',
  cyan: '#22d3ee',
} as const;

const T = SOCIAL_TONES;

/** A pond's water when it has no fill of its own, and its deep twin on dark paper. */
export const POND_FILL = '#7dd3fc';
export const POND_FILL_DARK = '#1e4f6e';

// --- On the wall ----------------------------------------------------------------------------------------------

/** Where the notice board's cork lies on its grid: the live note cards are laid out inside it. */
export const NOTICE_CORK = { x: 10, y: 14, w: 156, h: 104 } as const;

// A cork board in a wooden frame with a brass name plate; the notes are the live face's.
const NOTICE_BOARD_VIEW: FurnitureDrawing = {
  width: 176,
  height: 128,
  parts: [
    rect('panel', 0, 4, 176, 124, 6, T.frame),
    rect('panel', NOTICE_CORK.x, NOTICE_CORK.y, NOTICE_CORK.w, NOTICE_CORK.h, 3, T.cork),
    path('glint', 'M22 30h3M48 92h2M86 40h3M128 100h2M150 58h3M30 70h2M110 26h2M70 108h3'),
    rect('panel', 68, 0, 40, 10, 2, T.brass),
    path('rail', 'M76 5h24'),
  ],
  seats: [],
  ring: { cx: 88, cy: 64, rx: 86, ry: 62 },
};

/** Where the world clock's dials sit on its grid: the plaque's face, inside its edge. */
export const CLOCK_FACE = { x: 8, y: 14, w: 152, h: 52 } as const;

// A wooden plaque hung from a nail; the dials are the live face's.
const WORLD_CLOCK_VIEW: FurnitureDrawing = {
  width: 168,
  height: 72,
  parts: [
    path('line', 'M70 12L84 3L98 12'),
    ellipse('panel', 84, 3, 2.5, 2.5, T.brass),
    rect('panel', 0, 10, 168, 60, 12, T.wood),
    rect('face', 0, 62, 168, 8, 4, T.wood),
    rect('panel', CLOCK_FACE.x, CLOCK_FACE.y, CLOCK_FACE.w, CLOCK_FACE.h - 2, 9, T.woodDeep),
  ],
  seats: [],
  ring: { cx: 84, cy: 40, rx: 82, ry: 30 },
};

// --- Recreation -----------------------------------------------------------------------------------------------

/** The jukebox's lit arch on its grid, which glows while it plays for you. */
export const JUKEBOX_ARCH = 'M12 60V42C12 26 22 14 36 14C50 14 60 26 60 42V60Z';

// A rounded jukebox: a lit arch over a record window, a speaker grille, a chrome base.
const JUKEBOX_VIEW: FurnitureDrawing = {
  width: 72,
  height: 112,
  parts: [
    ellipse('shadow', 36, 109, 34, 3),
    path('panel', 'M4 106V40C4 18 18 4 36 4C54 4 68 18 68 40V106Z', T.jukebox),
    path('panel', JUKEBOX_ARCH, T.glow),
    path(
      'rail',
      'M20 58V44C20 33 27 25 36 25C45 25 52 33 52 44V58M28 58V45C28 39 32 34 36 34C40 34 44 39 44 45V58',
    ),
    rect('panel', 14, 64, 44, 18, 4, T.chrome),
    ellipse('panel', 36, 73, 13, 5, T.record),
    ellipse('mark', 36, 73, 3, 1.4, T.glow),
    rect('face', 14, 86, 44, 14, 3, T.jukeboxDeep),
    path('rail', 'M18 90h36M18 93h36M18 96h36'),
    rect('panel', 2, 100, 68, 8, 3, T.chrome),
  ],
  seats: [],
  ring: { cx: 36, cy: 100, rx: 34, ry: 8 },
};

// Its back to you: the cabinet's plain back with a vented service door, the chrome base, the lights out of sight.
const JUKEBOX_BACK: FurnitureDrawing = {
  width: 72,
  height: 112,
  parts: [
    ellipse('shadow', 36, 109, 34, 3),
    path('panel', 'M4 106V40C4 18 18 4 36 4C54 4 68 18 68 40V106Z', T.jukebox),
    path('face', 'M14 98V42C14 26 24 16 36 16C48 16 58 26 58 42V98Z', T.jukeboxDeep),
    path('rail', 'M24 36h24M22 42h28M22 48h28M22 54h28'),
    ellipse('panel', 36, 80, 3, 3, T.chrome),
    path('line', 'M50 98c0 6 6 6 10 8'),
    rect('panel', 2, 100, 68, 8, 3, T.chrome),
  ],
  seats: [],
  ring: { cx: 36, cy: 100, rx: 34, ry: 8 },
};

/** The lit strips a side-on jukebox shows: its arch's edge on its front and the lit tube round its side. */
export const JUKEBOX_ARCH_SIDE =
  'M5 60V40C5 30 7 22 11 17V60ZM18 60V30C20 22 28 16 39 15C44 15 47 18 47 24V60H43V25C43 21 41 19 39 19C30 20 24 25 22 31V60Z';

// Facing left: its rounded side toward you with a lit tube round it, its front a narrow strip down the left (the
// arch's edge, the record window, the grille), the chrome base under both.
const JUKEBOX_SIDE: FurnitureDrawing = {
  width: 56,
  height: 112,
  parts: [
    ellipse('shadow', 28, 109, 26, 3),
    path('panel', 'M12 106V14C18 9 28 6 40 6C48 6 53 12 53 22V106Z', T.jukebox),
    path('panel', 'M3 106V40C3 28 6 19 12 12V106Z', T.jukebox),
    path('panel', JUKEBOX_ARCH_SIDE, T.glow),
    rect('panel', 5, 64, 6, 18, 2, T.chrome),
    rect('face', 5, 86, 6, 14, 2, T.jukeboxDeep),
    rect('face', 18, 68, 29, 30, 4, T.jukeboxDeep),
    path('rail', 'M22 76h21M22 82h21M22 88h21'),
    rect('panel', 1, 100, 54, 8, 3, T.chrome),
  ],
  seats: [],
  ring: { cx: 28, cy: 100, rx: 26, ry: 8 },
};

/** The ping-pong table's top on its grid: the rally's ball flies over it. */
export const PING_PONG_TOP = { x: 28, y: 30, w: 128, h: 44 } as const;

// A green table with white lines, a net across the middle and a paddle resting at each end.
const PING_PONG_TABLE_VIEW: FurnitureDrawing = {
  width: PING_PONG_SEATS.width,
  height: PING_PONG_SEATS.height,
  parts: [
    ellipse('shadow', 92, 104, 82, 4),
    path('line', 'M40 78v22M144 78v22M64 78v18M120 78v18'),
    rect('panel', PING_PONG_TOP.x, PING_PONG_TOP.y, PING_PONG_TOP.w, PING_PONG_TOP.h, 3, T.felt),
    rect('mark', 31, 33, 122, 1.4, 0, T.line),
    rect('mark', 31, 69.6, 122, 1.4, 0, T.line),
    rect('mark', 31, 51.3, 122, 1.4, 0, T.line),
    rect('mark', 31, 33, 1.4, 38, 0, T.line),
    rect('mark', 151.6, 33, 1.4, 38, 0, T.line),
    rect('face', PING_PONG_TOP.x, 74, PING_PONG_TOP.w, 6, 2, T.feltDeep),
    rect('panel', 90, 22, 4, 56, 1.5, T.line),
    path('rail', 'M92 26v48'),
    path('line', 'M46 46l-7 6M138 58l7 -6'),
    ellipse('panel', 50, 43, 6.5, 5.5, T.paddleRed),
    ellipse('panel', 134, 61, 6.5, 5.5, T.paddleDark),
  ],
  seats: PING_PONG_SEATS.seats.map(({ u, v }) => ({ u, v })),
  ring: { cx: 92, cy: 56, rx: 88, ry: 48 },
};

// Its back to you: the table reads the same from either long side, so only the paddles change ends (the left seat's
// red paddle now at the right, where that seat is).
const PING_PONG_TABLE_BACK: FurnitureDrawing = {
  ...PING_PONG_TABLE_VIEW,
  ...PING_PONG_SEATS_BACK,
  parts: [
    ...PING_PONG_TABLE_VIEW.parts.slice(0, -3),
    path('line', 'M138 46l7 6M46 58l-7 -6'),
    ellipse('panel', 134, 43, 6.5, 5.5, T.paddleRed),
    ellipse('panel', 50, 61, 6.5, 5.5, T.paddleDark),
  ],
};

/** The turned table's top on its side grid: its length runs down the canvas, the game's ends top and bottom. */
export const PING_PONG_TOP_SIDE = { x: 20, y: 30, w: 72, h: 120 } as const;

// Facing left: the table's length down the canvas, its near end's edge and legs at the foot, its long side a narrow
// strip down the left, the net standing across the middle, the left seat's red paddle at the far end.
const PING_PONG_TABLE_SIDE: FurnitureDrawing = {
  ...PING_PONG_SEATS_SIDE,
  parts: [
    ellipse('shadow', 56, 174, 48, 4),
    path('line', 'M28 156v16M84 156v16'),
    rect('face', 16, 32, 6, 124, 2, T.feltDeep),
    rect(
      'panel',
      PING_PONG_TOP_SIDE.x,
      PING_PONG_TOP_SIDE.y,
      PING_PONG_TOP_SIDE.w,
      PING_PONG_TOP_SIDE.h,
      3,
      T.felt,
    ),
    rect('mark', 23, 33, 66, 1.4, 0, T.line),
    rect('mark', 23, 145.6, 66, 1.4, 0, T.line),
    rect('mark', 23, 33, 1.4, 114, 0, T.line),
    rect('mark', 87.6, 33, 1.4, 114, 0, T.line),
    rect('mark', 55.3, 33, 1.4, 114, 0, T.line),
    rect('face', PING_PONG_TOP_SIDE.x, 150, PING_PONG_TOP_SIDE.w, 6, 2, T.feltDeep),
    rect('panel', 12, 84, 88, 6, 1.5, T.line),
    path('rail', 'M16 87h80'),
    path('line', 'M38 42l-6 -6M74 136l6 6'),
    ellipse('panel', 42, 46, 5.5, 6.5, T.paddleRed),
    ellipse('panel', 70, 132, 5.5, 6.5, T.paddleDark),
  ],
  ring: { cx: 56, cy: 92, rx: 48, ry: 84 },
};

/** The arcade machine's screen on its grid, which shimmers. */
export const ARCADE_SCREEN = { x: 14, y: 28, w: 36, h: 26 } as const;

// An upright cabinet: a lit marquee, a dark screen, a control panel with a joystick and two buttons, a coin door.
const ARCADE_MACHINE_VIEW: FurnitureDrawing = {
  width: 64,
  height: 112,
  parts: [
    ellipse('shadow', 32, 109, 30, 3),
    path('panel', 'M6 108V20L14 4H50L58 20V108Z', T.cabinetDeep),
    rect('panel', 10, 8, 44, 12, 2, T.glow),
    path('glint', 'M14 12h12'),
    rect('face', 10, 24, 44, 34, 3, T.cabinet),
    rect('mark', ARCADE_SCREEN.x, ARCADE_SCREEN.y, ARCADE_SCREEN.w, ARCADE_SCREEN.h, 2, T.screen),
    path('glint', 'M18 50L28 32'),
    path('panel', 'M6 62H58L62 74H2Z', T.cabinet),
    path('line', 'M20 67v-6'),
    ellipse('panel', 20, 60, 3, 3, T.paddleRed),
    ellipse('panel', 38, 68, 3, 2, T.yellow),
    ellipse('panel', 47, 68, 3, 2, T.cyan),
    rect('panel', 8, 74, 48, 34, 2, T.cabinet),
    rect('face', 25, 82, 14, 12, 2, T.cabinetDeep),
    path('rail', 'M30 88h4'),
  ],
  seats: [],
  ring: { cx: 32, cy: 100, rx: 30, ry: 8 },
};

// Its back to you: the cabinet's back with its service door and vents, the control panel's ends showing either side
// beyond it, the marquee's lit edge along the top. The screen is out of sight.
const ARCADE_MACHINE_BACK: FurnitureDrawing = {
  width: 64,
  height: 112,
  parts: [
    ellipse('shadow', 32, 109, 30, 3),
    path('panel', 'M2 70L6 62H58L62 70Z', T.cabinet),
    path('panel', 'M6 108V20L14 4H50L58 20V108Z', T.cabinetDeep),
    rect('panel', 14, 4, 36, 4, 1.5, T.glow),
    rect('face', 12, 26, 40, 74, 3, T.cabinetDeep),
    path('rail', 'M20 34h24M20 39h24M20 44h24M20 49h24'),
    ellipse('panel', 44, 70, 2.5, 2.5, T.chrome),
    path('line', 'M24 100c0 5 -4 7 -10 8'),
  ],
  seats: [],
  ring: { cx: 32, cy: 100, rx: 30, ry: 8 },
};

/** The turned arcade machine's screen on its side grid: a slanted strip of the glass down its front. */
export const ARCADE_SCREEN_SIDE = 'M17 26L23 28L20 58L13 58Z';

// Facing left: the cabinet's tall side toward you in its arcade profile (the marquee jutting, the screen set back, the
// control panel jutting again), a stripe of art on it, and its front a narrow strip down the left: the lit marquee,
// a slice of the glowing screen, the joystick on the panel and the coin door.
const ARCADE_MACHINE_SIDE: FurnitureDrawing = {
  width: 60,
  height: 112,
  parts: [
    ellipse('shadow', 32, 109, 28, 3),
    path('panel', 'M18 108V76L10 72V64L22 62L26 28L18 22V8L22 4H56V108Z', T.cabinetDeep),
    path('panel', 'M30 34L50 26V42L30 50Z', T.cabinet),
    path('mark', 'M34 72L46 66V72L34 78Z', T.cyan),
    rect('panel', 12, 6, 7, 15, 2, T.glow),
    path('panel', 'M14 23L26 28L23 61L10 61Z', T.cabinet),
    path('mark', ARCADE_SCREEN_SIDE, T.screen),
    path('panel', 'M3 64H24V72H2Z', T.cabinet),
    path('line', 'M9 66v-6'),
    ellipse('panel', 9, 59, 3, 3, T.paddleRed),
    ellipse('panel', 18, 66, 2.5, 1.6, T.yellow),
    rect('panel', 10, 74, 9, 34, 2, T.cabinet),
    rect('face', 11.5, 84, 6, 12, 1.5, T.cabinetDeep),
  ],
  seats: [],
  ring: { cx: 32, cy: 100, rx: 28, ry: 8 },
};

/** Where a fire burns on its piece's grid: the flicker's flames stand on this base line. */
export const FIREPLACE_FLAMES = { cx: 64, base: 86 } as const;
export const CAMPFIRE_FLAMES = { cx: 40, base: 50 } as const;

// A pair of flames standing on (cx, base), `tall` px high: the outer orange one and the hot yellow heart.
function flames(cx: number, base: number, tall: number): FurniturePart[] {
  const w = tall * 0.55;
  const outer =
    `M${cx - w} ${base}C${cx - w} ${base - tall * 0.5} ${cx - w * 0.3} ${base - tall * 0.6} ${cx} ${base - tall}` +
    `C${cx + w * 0.3} ${base - tall * 0.6} ${cx + w} ${base - tall * 0.5} ${cx + w} ${base}Z`;
  const t = tall * 0.6;
  const v = t * 0.5;
  const inner =
    `M${cx - v} ${base}C${cx - v} ${base - t * 0.5} ${cx - v * 0.2} ${base - t * 0.6} ${cx} ${base - t}` +
    `C${cx + v * 0.2} ${base - t * 0.6} ${cx + v} ${base - t * 0.5} ${cx + v} ${base}Z`;
  return [path('mark', outer, T.flame), path('mark', inner, T.flameHot)];
}

// A brick fireplace under a wooden mantel, logs burning in its arched firebox, a stone hearth.
const FIREPLACE_VIEW: FurnitureDrawing = {
  width: 128,
  height: 120,
  parts: [
    ellipse('shadow', 64, 117, 62, 3),
    rect('panel', 18, 0, 92, 22, 2, T.brickDeep),
    rect('panel', 8, 28, 112, 72, 3, T.brick),
    path(
      'rail',
      'M8 42h112M8 56h112M8 70h112M8 84h112M30 28v14M64 28v14M98 28v14M46 42v14M82 42v14M20 56v14M108 56v14M20 70v14M108 70v14',
    ),
    rect('panel', 0, 20, 128, 10, 3, T.wood),
    path('panel', 'M32 98V62C32 52 40 46 50 46H78C88 46 96 52 96 62V98Z', T.soot),
    ...flames(FIREPLACE_FLAMES.cx, FIREPLACE_FLAMES.base, 30),
    rect('panel', 42, 86, 44, 7, 3, T.woodDeep),
    rect('panel', 48, 80, 32, 6, 3, T.bark),
    rect('panel', 4, 98, 120, 12, 3, T.stoneDeep),
    rect('face', 4, 108, 120, 6, 2, T.stoneDeep),
  ],
  seats: [],
  ring: { cx: 64, cy: 108, rx: 62, ry: 8 },
};

// Its back to you: the chimney breast's plain brick back, the mantel's top beyond it, the chimney above. The fire is
// out of sight.
const FIREPLACE_BACK: FurnitureDrawing = {
  width: 128,
  height: 120,
  parts: [
    ellipse('shadow', 64, 117, 62, 3),
    rect('panel', 18, 0, 92, 22, 2, T.brickDeep),
    rect('panel', 0, 20, 128, 9, 3, T.wood),
    rect('face', 8, 26, 112, 86, 3, T.brick),
    path(
      'rail',
      'M8 40h112M8 54h112M8 68h112M8 82h112M8 96h112M30 26v14M64 26v14M98 26v14M46 40v14M82 40v14M20 54v14M64 54v14M108 54v14M46 68v14M82 68v14M30 82v14M98 82v14M64 96v16',
    ),
  ],
  seats: [],
  ring: { cx: 64, cy: 108, rx: 62, ry: 8 },
};

/** Where the fire burns on the turned fireplace's side grid: a sliver of flame in the firebox's edge. */
export const FIREPLACE_FLAMES_SIDE = { cx: 14, base: 86 } as const;

// Facing left: the chimney breast's brick side toward you, the mantel's end and the hearth jutting left past it, and
// its front a narrow strip down the left: the firebox's arched edge with a sliver of the fire burning in it.
const FIREPLACE_SIDE: FurnitureDrawing = {
  width: 48,
  height: 120,
  parts: [
    ellipse('shadow', 24, 117, 22, 3),
    rect('panel', 22, 0, 22, 22, 2, T.brickDeep),
    rect('panel', 18, 28, 26, 72, 3, T.brick),
    path(
      'rail',
      'M18 42h26M18 56h26M18 70h26M18 84h26M30 28v14M36 42v14M30 56v14M36 70v14M30 84v14',
    ),
    rect('panel', 8, 28, 10, 72, 2, T.brick),
    path('rail', 'M8 42h10M8 56h4'),
    path('panel', 'M10 98V58C10 53 12 50 16 48V98Z', T.soot),
    path(
      'mark',
      `M11 ${FIREPLACE_FLAMES_SIDE.base}C11 78 13 74 15 66C16 74 18 78 17 ${FIREPLACE_FLAMES_SIDE.base}Z`,
      T.flame,
    ),
    path(
      'mark',
      `M12.5 ${FIREPLACE_FLAMES_SIDE.base}C12.5 82 14 79 15 75C16 79 16.5 82 16.5 ${FIREPLACE_FLAMES_SIDE.base}Z`,
      T.flameHot,
    ),
    rect('panel', 10, 86, 7, 7, 3, T.woodDeep),
    rect('panel', 4, 20, 42, 10, 3, T.wood),
    rect('panel', 2, 98, 44, 12, 3, T.stoneDeep),
    rect('face', 2, 108, 44, 6, 2, T.stoneDeep),
  ],
  seats: [],
  ring: { cx: 24, cy: 108, rx: 22, ry: 8 },
};

// Stones round a fire, back half then front half, on an ellipse round (40, 56).
function stoneRing(front: boolean): FurniturePart[] {
  const out: FurniturePart[] = [];
  const count = 10;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const y = Math.sin(a);
    if (front !== y >= 0) continue;
    const cx = Math.round((40 + Math.cos(a) * 28) * 10) / 10;
    const cy = Math.round((56 + y * 10) * 10) / 10;
    out.push(ellipse('panel', cx, cy, 6, 4, i % 2 === 0 ? T.stone : T.stoneDeep));
  }
  return out;
}

// Logs crossed in a ring of stones, flames rising from them.
const CAMPFIRE_VIEW: FurnitureDrawing = {
  width: 80,
  height: 72,
  parts: [
    ellipse('shadow', 40, 60, 36, 8),
    ...stoneRing(false),
    path('panel', 'M22 58L54 46L57 51L25 63Z', T.woodDeep),
    path('panel', 'M58 58L26 46L23 51L55 63Z', T.bark),
    ...flames(CAMPFIRE_FLAMES.cx, CAMPFIRE_FLAMES.base, 30),
    ...stoneRing(true),
  ],
  seats: [],
  ring: { cx: 40, cy: 56, rx: 36, ry: 14 },
};

// --- Outdoor seating -----------------------------------------------------------------------------------------

// A wooden garden bench with a slatted back and iron arms: two seats side by side.
const BENCH_VIEW: FurnitureDrawing = {
  width: BENCH_SEATS.width,
  height: BENCH_SEATS.height,
  parts: [
    ellipse('shadow', 68, 61, 62, 3),
    path('line', 'M16 46v14M120 46v14'),
    path('line', 'M20 22v12M116 22v12'),
    rect('panel', 8, 4, 120, 8, 2, T.wood),
    rect('panel', 8, 15, 120, 8, 2, T.wood),
    rect('panel', 4, 32, 128, 11, 3, T.wood),
    path('rail', 'M8 37.5h120'),
    rect('face', 4, 41, 128, 5, 2, T.wood),
    rect('panel', 0, 24, 8, 24, 3, T.iron),
    rect('panel', 128, 24, 8, 24, 3, T.iron),
  ],
  seats: BENCH_SEATS.seats.map(({ u, v }) => ({ u, v })),
  ring: { cx: 68, cy: 38, rx: 64, ry: 10 },
  ringUnder: 6,
};

// From behind: the seat beyond, the slatted back's two rails nearest you on their supports, the iron arms either end.
const BENCH_BACK: FurnitureDrawing = {
  ...BENCH_SEATS_BACK,
  parts: [
    ellipse('shadow', 68, 61, 62, 3),
    path('line', 'M16 40v20M120 40v20'),
    rect('panel', 4, 12, 128, 11, 3, T.wood),
    path('rail', 'M8 17.5h120'),
    path('line', 'M20 26v18M116 26v18'),
    rect('face', 8, 22, 120, 8, 2, T.wood),
    rect('face', 8, 33, 120, 8, 2, T.wood),
    rect('panel', 0, 8, 8, 26, 3, T.iron),
    rect('panel', 128, 8, 8, 26, 3, T.iron),
  ],
  ring: { cx: 68, cy: 18, rx: 64, ry: 9 },
  ringUnder: 4,
};

// Facing left: long, its two seats one above the other down the slatted seat, the back a bar along its right, an
// iron arm across each end and its legs under the near end.
const BENCH_SIDE: FurnitureDrawing = {
  ...BENCH_SEATS_SIDE,
  parts: [
    ellipse('shadow', 28, 160, 26, 3),
    path('line', 'M10 148v12M42 148v12'),
    rect('panel', 40, 6, 9, 140, 2, T.wood),
    rect('panel', 5, 24, 34, 122, 3, T.wood),
    path('rail', 'M22 28v114'),
    rect('face', 5, 144, 34, 5, 2, T.wood),
    rect('panel', 2, 18, 48, 7, 3, T.iron),
    rect('panel', 2, 141, 48, 7, 3, T.iron),
  ],
  ring: { cx: 22, cy: 85, rx: 18, ry: 60 },
  ringUnder: 6,
};

// A wooden picnic table with a bench along each side: six seats facing the table.
const PICNIC_TABLE_VIEW: FurnitureDrawing = {
  width: PICNIC_TABLE_SEATS.width,
  height: PICNIC_TABLE_SEATS.height,
  parts: [
    ellipse('shadow', 100, 148, 96, 4),
    path('line', 'M30 40v8M170 40v8'),
    rect('panel', 20, 24, 160, 12, 3, T.wood),
    rect('face', 20, 34, 160, 4, 2, T.wood),
    path('line', 'M44 104l-12 30M156 104l12 30'),
    rect('panel', 12, 50, 176, 48, 4, T.wood),
    path('rail', 'M16 66H184M16 82H184'),
    rect('face', 12, 96, 176, 8, 3, T.wood),
    path('line', 'M30 126v14M170 126v14'),
    rect('panel', 20, 112, 160, 12, 3, T.wood),
    rect('face', 20, 122, 160, 5, 2, T.wood),
  ],
  seats: PICNIC_TABLE_SEATS.seats.map(({ u, v }) => ({ u, v })),
  ring: { cx: 100, cy: 76, rx: 96, ry: 70 },
};

// From behind a picnic table looks as it does from the front (a bench either side of the table), but turned half way
// round, so each seat is the one across the table from where it was drawn.
const PICNIC_TABLE_BACK: FurnitureDrawing = { ...PICNIC_TABLE_VIEW, ...PICNIC_TABLE_SEATS_BACK };

// Facing left: the table's top down the middle, a bench down each side, the near end's legs under them.
const PICNIC_TABLE_SIDE: FurnitureDrawing = {
  ...PICNIC_TABLE_SEATS_SIDE,
  parts: [
    ellipse('shadow', 72, 202, 68, 4),
    path('line', 'M17 183v14M127 183v14'),
    path('line', 'M52 188l-8 16M92 188l8 16'),
    rect('panel', 8, 20, 18, 160, 3, T.wood),
    rect('face', 8, 178, 18, 5, 2, T.wood),
    rect('panel', 118, 20, 18, 160, 3, T.wood),
    rect('face', 118, 178, 18, 5, 2, T.wood),
    rect('panel', 40, 8, 64, 176, 4, T.wood),
    path('rail', 'M61 12V180M83 12V180'),
    rect('face', 40, 182, 64, 8, 3, T.wood),
  ],
  ring: { cx: 72, cy: 100, rx: 68, ry: 96 },
};

// A striped hammock slung between two posts on ropes: one seat.
const HAMMOCK_VIEW: FurnitureDrawing = {
  width: HAMMOCK_SEATS.width,
  height: HAMMOCK_SEATS.height,
  parts: [
    ellipse('shadow', 76, 76, 62, 3),
    rect('panel', 4, 8, 8, 66, 2, T.woodDeep),
    rect('panel', 140, 8, 8, 66, 2, T.woodDeep),
    path('line', 'M12 16L30 32M140 16L122 32'),
    path('panel', 'M30 30C60 58 92 58 122 30L122 40C92 68 60 68 30 40Z', T.hammock),
    path('panel', 'M31 35C61 62 91 62 121 35L121 38C91 65 61 65 31 38Z', T.hammockBand),
    path('line', 'M30 28v14M122 28v14'),
  ],
  seats: HAMMOCK_SEATS.seats.map(({ u, v }) => ({ u, v })),
  ring: { cx: 76, cy: 50, rx: 46, ry: 14 },
  ringUnder: 4,
};

// Facing left: long, the sling down the canvas between its far post and its near post, its spreader bars across.
const HAMMOCK_SIDE: FurnitureDrawing = {
  ...HAMMOCK_SEATS_SIDE,
  parts: [
    ellipse('shadow', 32, 134, 9, 60),
    rect('panel', 28, 4, 8, 62, 2, T.woodDeep),
    path('line', 'M32 12V38'),
    path('panel', 'M30 38C14 62 12 106 26 136H38C52 106 50 62 34 38Z', T.hammock),
    path('panel', 'M30.5 40C24 66 23 106 30 134H34C41 106 40 66 33.5 40Z', T.hammockBand),
    path('line', 'M23 39h18M21 135h22'),
    rect('panel', 28, 134, 8, 62, 2, T.woodDeep),
  ],
  ring: { cx: 32, cy: 92, rx: 20, ry: 48 },
  ringUnder: 3,
};

// --- Garden scenery -------------------------------------------------------------------------------------------

// A striped parasol on a pole with a weighted base. Elements paint under avatars, so the canopy is part of the piece.
const GARDEN_UMBRELLA_VIEW: FurnitureDrawing = {
  width: 120,
  height: 152,
  parts: [
    ellipse('shadow', 60, 146, 52, 5),
    ellipse('panel', 60, 143, 13, 5, T.stoneDeep),
    path('line', 'M60 44V141'),
    path('panel', 'M4 46C18 12 102 12 116 46Z', T.canvas),
    path('panel', 'M60 15L4 46H20Z', T.stripe),
    path('panel', 'M60 15L36 46H52Z', T.stripe),
    path('panel', 'M60 15L68 46H84Z', T.stripe),
    path('panel', 'M60 15L100 46H116Z', T.stripe),
    path('rail', 'M4 46q8 6 16 0q8 6 16 0q8 6 16 0q8 6 16 0q8 6 16 0q8 6 16 0q8 6 16 0'),
    ellipse('panel', 60, 13, 3, 3, T.brass),
  ],
  seats: [],
  ring: { cx: 60, cy: 143, rx: 20, ry: 6 },
};

/** The fountain's basin water and its bowl on its grid: the live shimmer and spray sit on them. */
export const FOUNTAIN_WATER = { cx: 68, cy: 90, rx: 54, ry: 15 } as const;
export const FOUNTAIN_SPOUT = { x: 68, y: 28 } as const;

// A round stone basin, a two-tier spout in its middle.
const FOUNTAIN_VIEW: FurnitureDrawing = {
  width: 136,
  height: 120,
  parts: [
    ellipse('shadow', 68, 112, 66, 5),
    path('panel', 'M4 90C4 116 132 116 132 90V98C132 124 4 124 4 98Z', T.stoneDeep),
    ellipse('panel', 68, 90, 64, 22, T.stone),
    ellipse(
      'panel',
      FOUNTAIN_WATER.cx,
      FOUNTAIN_WATER.cy,
      FOUNTAIN_WATER.rx,
      FOUNTAIN_WATER.ry,
      T.water,
    ),
    path('glint', 'M34 88C44 82 58 80 70 80M88 96C96 95 104 92 108 88'),
    rect('panel', 62, 52, 12, 36, 2, T.stone),
    ellipse('panel', 68, 52, 26, 7, T.stone),
    ellipse('mark', 68, 51, 20, 4, T.waterDeep),
    rect('panel', 65, 30, 6, 20, 2, T.stone),
    ellipse('panel', 68, 30, 9, 3, T.stone),
    path('glint', 'M68 26C62 18 54 22 50 46M68 26C74 18 82 22 86 46'),
  ],
  seats: [],
  ring: { cx: 68, cy: 92, rx: 64, ry: 22 },
};

/** The grid pieces this module draws, for OFFICE_ART. */
export const OFFICE_SOCIAL_ART = {
  'notice-board': allSides(NOTICE_BOARD_VIEW),
  'world-clock': allSides(WORLD_CLOCK_VIEW),
  jukebox: { front: JUKEBOX_VIEW, back: JUKEBOX_BACK, side: JUKEBOX_SIDE },
  'ping-pong-table': {
    front: PING_PONG_TABLE_VIEW,
    back: PING_PONG_TABLE_BACK,
    side: PING_PONG_TABLE_SIDE,
  },
  'arcade-machine': {
    front: ARCADE_MACHINE_VIEW,
    back: ARCADE_MACHINE_BACK,
    side: ARCADE_MACHINE_SIDE,
  },
  fireplace: { front: FIREPLACE_VIEW, back: FIREPLACE_BACK, side: FIREPLACE_SIDE },
  campfire: allSides(CAMPFIRE_VIEW),
  bench: { front: BENCH_VIEW, back: BENCH_BACK, side: BENCH_SIDE },
  'picnic-table': { front: PICNIC_TABLE_VIEW, back: PICNIC_TABLE_BACK, side: PICNIC_TABLE_SIDE },
  hammock: { front: HAMMOCK_VIEW, back: HAMMOCK_VIEW, side: HAMMOCK_SIDE },
  'garden-umbrella': allSides(GARDEN_UMBRELLA_VIEW),
  fountain: allSides(FOUNTAIN_VIEW),
} as const;

/**
 * A pond's drawing, in its own px: a stone rim round the box, the water in the element's fill (the floor), two lily
 * pads with a flower and a glint. A fixed handful of shapes however big the pond.
 */
export function pondParts(width: number, height: number): FurniturePart[] {
  if (width <= 0 || height <= 0) return [];
  const cx = width / 2;
  const cy = height / 2;
  const n = (v: number) => Math.round(v * 100) / 100;
  const rim = Math.min(8, Math.min(width, height) * 0.08);
  const parts: FurniturePart[] = [
    ellipse('shadow', n(cx), n(cy + 3), n(width / 2), n(height / 2)),
    ellipse('panel', n(cx), n(cy), n(width / 2 - 1), n(height / 2 - 1), T.stone),
    ellipse(
      'floor',
      n(cx),
      n(cy),
      n(Math.max(0, width / 2 - rim - 1)),
      n(Math.max(0, height / 2 - rim - 1)),
    ),
  ];
  const pad = Math.min(10, Math.min(width, height) * 0.1);
  if (pad >= 3) {
    parts.push(ellipse('panel', n(width * 0.32), n(height * 0.42), n(pad), n(pad * 0.62), T.lily));
    parts.push(
      ellipse('panel', n(width * 0.64), n(height * 0.62), n(pad * 0.8), n(pad * 0.5), T.lily),
    );
    parts.push(
      ellipse(
        'mark',
        n(width * 0.32 + pad * 0.3),
        n(height * 0.42 - pad * 0.15),
        n(pad * 0.28),
        n(pad * 0.22),
        T.pink,
      ),
    );
    parts.push(
      path(
        'glint',
        `M${n(width * 0.2)} ${n(height * 0.68)}q${n(width * 0.08)} ${n(height * 0.06)} ${n(width * 0.18)} 0`,
      ),
    );
  }
  return parts;
}

// --- Notes, zones and a source ---------------------------------------------------------------------------------

export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple';
export const NOTE_COLORS: readonly NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'purple'];
export const DEFAULT_NOTE_COLOR: NoteColor = 'yellow';
/** A note card's paper, by colour. */
export const NOTE_PAPER: Record<NoteColor, string> = {
  yellow: '#fef08a',
  pink: '#fbcfe8',
  blue: '#bfdbfe',
  green: '#bbf7d0',
  purple: '#ddd6fe',
};
export const NOTE_COLOR_LABELS: Record<NoteColor, string> = {
  yellow: 'Yellow',
  pink: 'Pink',
  blue: 'Blue',
  green: 'Green',
  purple: 'Purple',
};

/** One note pinned on a notice board (docs/specs/009-elements/social-pieces.md "Notice Board"). */
export type NoticeNote = {
  id: string;
  title?: string;
  text: string;
  author: string;
  // The pinner's adder key (or an Editor's participant key): who may unpin it.
  by: string;
  // When it was pinned, epoch ms.
  at: number;
  color?: NoteColor;
  // The day it is pinned to, on a Calendar Wall (docs/specs/009-elements/team-pieces.md "Calendar Wall"): `YYYY-MM-DD`.
  day?: string;
};

/** The pieces whose notes are `noticeNotes`, changed by the `notice-pin` and `notice-unpin` deltas. */
export const NOTE_PIECE_KINDS: readonly string[] = ['notice-board', 'calendar-wall'];
export function holdsNotes(kind: string): boolean {
  return NOTE_PIECE_KINDS.includes(kind);
}

const pad2 = (v: number) => String(v).padStart(2, '0');

/** The first and last years a note's day may fall in: the Calendar Wall's ‹ and › stop at them. */
export const NOTE_DAY_YEAR_MIN = 2000;
export const NOTE_DAY_YEAR_MAX = 2100;

/** A calendar day (`YYYY-MM-DD`, years 2000 to 2100), checked against its month's length. Parsed by position. */
export function isNoteDay(v: unknown): v is string {
  if (typeof v !== 'string' || v.length !== 10 || v[4] !== '-' || v[7] !== '-') return false;
  const digits = v.slice(0, 4) + v.slice(5, 7) + v.slice(8, 10);
  for (const c of digits) if (c < '0' || c > '9') return false;
  const year = Number(v.slice(0, 4));
  const month = Number(v.slice(5, 7));
  const day = Number(v.slice(8, 10));
  if (year < NOTE_DAY_YEAR_MIN || year > NOTE_DAY_YEAR_MAX || month < 1 || month > 12 || day < 1)
    return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The `YYYY-MM-DD` of a moment on this screen's clock. */
export function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** The day a note counts on: its own, else the day it was pinned, on this screen's clock. */
export function noteDay(note: NoticeNote): string {
  return note.day ?? localDay(note.at);
}

/** The latest time a JavaScript date holds (8.64e15 ms, about the year 275760). */
const DATE_MS_MAX = 8.64e15;

export const NOTE_TITLE_MAX = 60;
export const NOTE_TEXT_MAX = 280;
export const NOTE_AUTHOR_MAX = 60;
export const NOTES_MAX = 50;
/** How many notes the board's face shows. */
export const NOTES_ON_FACE = 4;

const isStrUpTo =
  (max: number) =>
  (v: unknown): v is string =>
    typeof v === 'string' && v.length <= max;

export function isNoteColor(v: unknown): v is NoteColor {
  return (NOTE_COLORS as readonly unknown[]).includes(v);
}

export function isNoticeNote(v: unknown): v is NoticeNote {
  if (typeof v !== 'object' || v === null) return false;
  const n = v as Record<string, unknown>;
  return (
    typeof n.id === 'string' &&
    n.id.length > 0 &&
    n.id.length <= 64 &&
    (n.title === undefined || isStrUpTo(NOTE_TITLE_MAX)(n.title)) &&
    typeof n.text === 'string' &&
    n.text.trim().length > 0 &&
    n.text.length <= NOTE_TEXT_MAX &&
    isStrUpTo(NOTE_AUTHOR_MAX)(n.author) &&
    typeof n.by === 'string' &&
    n.by.length > 0 &&
    n.by.length <= 128 &&
    // A time a date can show: the face prints the day it was pinned, which throws past Date's range.
    typeof n.at === 'number' &&
    Number.isInteger(n.at) &&
    n.at >= 0 &&
    n.at <= DATE_MS_MAX &&
    (n.color === undefined || isNoteColor(n.color)) &&
    (n.day === undefined || isNoteDay(n.day))
  );
}

/** The note's own fields alone, so a field the wire does not define is never stored on the board. */
export function noteFields(n: NoticeNote): NoticeNote {
  return {
    id: n.id,
    ...(n.title === undefined ? {} : { title: n.title }),
    text: n.text,
    author: n.author,
    by: n.by,
    at: n.at,
    ...(n.color === undefined ? {} : { color: n.color }),
    ...(n.day === undefined ? {} : { day: n.day }),
  };
}

export function isNoticeNotes(v: unknown): v is NoticeNote[] {
  if (!Array.isArray(v) || v.length > NOTES_MAX || !v.every(isNoticeNote)) return false;
  return new Set(v.map((n) => n.id)).size === v.length;
}

/** The notes newest first, for the face and the popover. */
export function notesNewestFirst(notes: readonly NoticeNote[] | undefined): NoticeNote[] {
  return [...(notes ?? [])].sort((a, b) => b.at - a.at);
}

/**
 * What a Participant's update leaves on a notice board (docs/specs/013-workspace/share-roles.md): every stored note
 * it did not sign, its own stored notes the incoming list still holds, and the notes the incoming list adds that it
 * signed. Anything else the incoming list says is ignored. Answers the stored array itself when nothing changes.
 */
export function mergeNoticeNotes(
  stored: readonly NoticeNote[] | undefined,
  incoming: unknown,
  adderKey: string | null,
): NoticeNote[] | undefined {
  if (!adderKey || !Array.isArray(incoming)) return stored ? [...stored] : undefined;
  const before = stored ?? [];
  const incomingIds = new Set(
    incoming.filter((n): n is NoticeNote => isNoticeNote(n)).map((n) => n.id),
  );
  const storedIds = new Set(before.map((n) => n.id));
  const kept = before.filter((n) => n.by !== adderKey || incomingIds.has(n.id));
  const added = incoming
    .filter((n): n is NoticeNote => isNoticeNote(n) && n.by === adderKey && !storedIds.has(n.id))
    .map(noteFields);
  const next = [...kept, ...added].slice(0, NOTES_MAX);
  if (next.length === before.length && next.every((n, i) => n === before[i]))
    return stored ? [...stored] : undefined;
  return next.length > 0 ? next : undefined;
}

/** One time zone on a world clock: an IANA zone and its label. */
export type ClockZone = { zone: string; label: string };
export const CLOCK_ZONES_MAX = 6;
export const CLOCK_LABEL_MAX = 24;
/** How many dials the clock's face shows. */
export const CLOCK_DIALS_ON_FACE = 3;
// An IANA name's shape ("Europe/London", "America/Argentina/Buenos_Aires", "UTC", "Etc/GMT+5"); whether the browser
// knows it is the face's question (an unknown one draws an empty dial).
const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]{0,30}(?:\/[A-Za-z0-9_+-]{1,30}){0,2}$/;

export function isClockZone(v: unknown): v is ClockZone {
  if (typeof v !== 'object' || v === null) return false;
  const z = v as Record<string, unknown>;
  return (
    typeof z.zone === 'string' && ZONE_PATTERN.test(z.zone) && isStrUpTo(CLOCK_LABEL_MAX)(z.label)
  );
}

export function isClockZones(v: unknown): v is ClockZone[] {
  return Array.isArray(v) && v.length <= CLOCK_ZONES_MAX && v.every(isClockZone);
}

/** The label a zone suggests: its city, underscores as spaces ("America/New_York" → "New York"). */
export function zoneCityLabel(zone: string): string {
  const city = zone.split('/').pop() ?? zone;
  return city.replace(/_/g, ' ').slice(0, CLOCK_LABEL_MAX);
}

export const JUKEBOX_SOURCE_MAX = 500;

/** Whether a value is a jukebox source: an https address of at most JUKEBOX_SOURCE_MAX characters. */
export function isJukeboxSource(v: unknown): v is string {
  if (typeof v !== 'string' || v.length === 0 || v.length > JUKEBOX_SOURCE_MAX) return false;
  try {
    const url = new URL(v);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
}
