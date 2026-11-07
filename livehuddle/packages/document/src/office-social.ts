// The social pieces (docs/specs/009-elements/social-pieces.md): the Notice Board, World Clock, Jukebox, Ping-Pong
// Table, Arcade Machine, Fireplace, Campfire, Bench, Picnic Table, Hammock, Garden Umbrella, Fountain and Pond. Their
// drawings are tables of parts in the furniture's vocabulary (seating.ts), drawn upright from the room's camera like
// the rest of the office, which both renderers paint (the editor's views and svg-render-faces). The grid pieces join
// OFFICE_ART (office.ts); the pond is drawn to its own size, as grass is. The notes a notice board holds, the zones a
// world clock shows and a jukebox's source are element fields, bounded and checked here. The geometry the walk needs
// (the seats, the footprints) is @liveworkspace/avatar's. Pure: no React, no DOM.

import type { FurnitureDrawing, FurniturePart } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';
import {
  BENCH_SEATS,
  HAMMOCK_SEATS,
  PICNIC_TABLE_SEATS,
  PING_PONG_SEATS,
} from '@liveworkspace/avatar/seats';

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
  jukebox: allSides(JUKEBOX_VIEW),
  'ping-pong-table': allSides(PING_PONG_TABLE_VIEW),
  'arcade-machine': allSides(ARCADE_MACHINE_VIEW),
  fireplace: allSides(FIREPLACE_VIEW),
  campfire: allSides(CAMPFIRE_VIEW),
  bench: allSides(BENCH_VIEW),
  'picnic-table': allSides(PICNIC_TABLE_VIEW),
  hammock: allSides(HAMMOCK_VIEW),
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

/** A calendar day (`YYYY-MM-DD`, years 2000 to 2100), checked against its month's length. Parsed by position. */
export function isNoteDay(v: unknown): v is string {
  if (typeof v !== 'string' || v.length !== 10 || v[4] !== '-' || v[7] !== '-') return false;
  const digits = v.slice(0, 4) + v.slice(5, 7) + v.slice(8, 10);
  for (const c of digits) if (c < '0' || c > '9') return false;
  const year = Number(v.slice(0, 4));
  const month = Number(v.slice(5, 7));
  const day = Number(v.slice(8, 10));
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
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
    typeof n.at === 'number' &&
    Number.isFinite(n.at) &&
    (n.color === undefined || isNoteColor(n.color)) &&
    (n.day === undefined || isNoteDay(n.day))
  );
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
  const added = incoming.filter(
    (n): n is NoticeNote => isNoticeNote(n) && n.by === adderKey && !storedIds.has(n.id),
  );
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
