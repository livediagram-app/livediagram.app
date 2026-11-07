// The team pieces (docs/specs/009-elements/team-pieces.md): the Calendar Wall, the Suggestion Box, the Signpost and the
// Team Photo Wall. Drawings in the furniture's vocabulary (seating.ts), upright from the room's camera like the rest of
// the office, which both renderers paint (the editor's views and svg-render-faces). The live parts (the month and its
// notes, the signpost's arrows, the portraits) are the editor's, laid over these at the grid spots named here; an export
// draws the art alone: a ruled sheet, blank boards and empty frames. Pure: no React, no DOM.

import type { FurnitureDrawing, FurniturePart } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';

// Fixed colours, as SOCIAL_TONES: paper, the planner's red band and rings, wood, grass, brass and the frames' mats.
// Outlines stay the theme's stroke.
export const TEAM_TONES = {
  paper: '#ffffff',
  strip: '#f1f5f9',
  header: '#ef4444',
  ring: '#94a3b8',
  wood: '#c2894b',
  woodDeep: '#92400e',
  cream: '#fef3c7',
  bulb: '#facc15',
  bulbBase: '#a16207',
  slot: '#292524',
  grass: '#86efac',
  board: '#e0b07a',
  nail: '#57534e',
  panel: '#a3734a',
  linen: '#f5efe6',
  brass: '#e0b232',
  frame: '#5b3a1e',
  mat: '#f8fafc',
  silhouette: '#cbd5e1',
} as const;

const T = TEAM_TONES;
const n = (v: number) => Math.round(v * 100) / 100;

// --- Calendar Wall ------------------------------------------------------------------------------------------------

/** The planner's header band, where the month and year are written. */
export const CALENDAR_HEADER = { x: 0, y: 10, w: 200, h: 28 } as const;
/** The weekday initials' strip. */
export const CALENDAR_WEEKDAYS = { x: 8, y: 42, w: 184, h: 10 } as const;
/** The ruled grid of days: seven columns (Monday first) by six rows, enough for any month. */
export const CALENDAR_GRID = { x: 8, y: 54, w: 184, h: 100, cols: 7, rows: 6 } as const;

function calendarRules(): string {
  const { x, y, w, h, cols, rows } = CALENDAR_GRID;
  let d = `M${x} ${y}h${w}v${h}h${-w}Z`;
  for (let c = 1; c < cols; c += 1) d += `M${n(x + (w / cols) * c)} ${y}v${h}`;
  for (let r = 1; r < rows; r += 1) d += `M${x} ${n(y + (h / rows) * r)}h${w}`;
  return d;
}

// A wall planner: a white sheet hung from two binder rings, a red band across its head, a strip for the weekdays and
// a ruled month of days; the month itself is the live face's.
const CALENDAR_WALL_VIEW: FurnitureDrawing = {
  width: 200,
  height: 160,
  parts: [
    rect('panel', 0, 10, 200, 150, 6, T.paper),
    path('panel', 'M6 10h188a6 6 0 0 1 6 6v22H0V16a6 6 0 0 1 6-6z', T.header),
    path('glint', 'M14 18h40'),
    rect('panel', 46, 2, 8, 16, 4, T.ring),
    rect('panel', 146, 2, 8, 16, 4, T.ring),
    rect(
      'panel',
      CALENDAR_WEEKDAYS.x,
      CALENDAR_WEEKDAYS.y,
      CALENDAR_WEEKDAYS.w,
      CALENDAR_WEEKDAYS.h,
      2,
      T.strip,
    ),
    path('rail', calendarRules()),
  ],
  seats: [],
  ring: { cx: 100, cy: 84, rx: 98, ry: 74 },
};

// --- Suggestion Box -----------------------------------------------------------------------------------------------

// A wooden box on a post: a note half posted through the slot in its lid, a lightbulb on a cream plate on its front.
// The paper is drawn before the lid, so its foot goes into the slot.
const SUGGESTION_BOX_VIEW: FurnitureDrawing = {
  width: 64,
  height: 112,
  parts: [
    ellipse('shadow', 32, 108, 22, 3),
    rect('face', 14, 100, 36, 8, 2, T.woodDeep),
    rect('face', 28, 62, 8, 40, 2, T.wood),
    rect('panel', 6, 24, 52, 42, 4, T.wood),
    rect('panel', 14, 33, 36, 26, 3, T.cream),
    path('rail', 'M32 37.5v-2M25 40l-1.5-1.5M39 40l1.5-1.5'),
    ellipse('mark', 32, 45, 6, 6, T.bulb),
    rect('mark', 29, 50, 6, 5, 1, T.bulbBase),
    path('glint', 'M29.5 44a2.5 2.5 0 0 1 2.5-2.5'),
    path('panel', 'M26 22L28 6H40L38 22Z', T.paper),
    path('rail', 'M30.5 10.5h7M30 14.5h6'),
    rect('panel', 2, 16, 60, 10, 3, T.woodDeep),
    rect('mark', 18, 19.5, 28, 3, 1.5, T.slot),
  ],
  seats: [],
  ring: { cx: 32, cy: 104, rx: 22, ry: 6 },
};

// --- Signpost -----------------------------------------------------------------------------------------------------

/** How many arrow boards a signpost carries (team-pieces.md "Signpost"). */
export const SIGNPOST_BOARDS = 3;
/** The boards' bodies on the signpost's grid, top to bottom. The live arrow covers its body and adds its tip. */
export const SIGNPOST_BOARD_RECTS = [
  { x: 18, y: 22, w: 84, h: 20 },
  { x: 18, y: 50, w: 84, h: 20 },
  { x: 18, y: 78, w: 84, h: 20 },
] as const;
/** How far an arrow's tip reaches past its board's body. */
export const SIGNPOST_TIP = 12;

// A wooden post on a mound of grass with a pointed cap and three blank boards nailed across it.
const SIGNPOST_VIEW: FurnitureDrawing = {
  width: 120,
  height: 144,
  parts: [
    ellipse('shadow', 60, 139, 34, 4),
    path('panel', 'M26 140C28 128 44 124 60 124C76 124 92 128 94 140Z', T.grass),
    path('rail', 'M38 134l-2-5M44 131l1-5M78 133l2-5M84 136l3-4'),
    rect('face', 55, 14, 10, 120, 2, T.wood),
    path('panel', 'M53 16L60 5L67 16Z', T.woodDeep),
    ...SIGNPOST_BOARD_RECTS.flatMap(({ x, y, w, h }): FurniturePart[] => [
      rect('panel', x, y, w, h, 2, T.board),
      ellipse('mark', 60, y + h / 2, 1.4, 1.4, T.nail),
    ]),
  ],
  seats: [],
  ring: { cx: 60, cy: 132, rx: 32, ry: 8 },
};

/** A board's arrow on the signpost's grid as one closed path: its body, then a tip toward `dir`. */
export function signpostArrowPath(index: number, dir: 'left' | 'right'): string {
  const b = SIGNPOST_BOARD_RECTS[index];
  if (!b) return '';
  const mid = b.y + b.h / 2;
  return dir === 'right'
    ? `M${b.x} ${b.y}H${b.x + b.w}L${b.x + b.w + SIGNPOST_TIP} ${mid}L${b.x + b.w} ${b.y + b.h}H${b.x}Z`
    : `M${b.x + b.w} ${b.y}H${b.x}L${b.x - SIGNPOST_TIP} ${mid}L${b.x} ${b.y + b.h}H${b.x + b.w}Z`;
}

// --- Team Photo Wall ----------------------------------------------------------------------------------------------

/** How many frames the wall holds (team-pieces.md "Team Photo Wall"). */
export const PHOTO_FRAMES = 8;
const FRAME_W = 33;
const FRAME_H = 40;
const MAT = 3;
/** Each frame on the wall's grid, row by row, left to right: the frame, and the mat a portrait fills. */
export const PHOTO_FRAME_RECTS: readonly {
  x: number;
  y: number;
  w: number;
  h: number;
  mat: { x: number; y: number; w: number; h: number };
}[] = Array.from({ length: PHOTO_FRAMES }, (_, i) => {
  const x = 10 + (i % 4) * (FRAME_W + 8);
  const y = 18 + Math.floor(i / 4) * (FRAME_H + 6);
  return {
    x,
    y,
    w: FRAME_W,
    h: FRAME_H,
    mat: { x: x + MAT, y: y + MAT, w: FRAME_W - 2 * MAT, h: FRAME_H - 2 * MAT },
  };
});

// An empty frame: the wooden frame, a pale mat and a soft silhouette (a head over shoulders), so a wall with few
// people in it reads as room to grow.
function emptyFrame(f: (typeof PHOTO_FRAME_RECTS)[number]): FurniturePart[] {
  const cx = f.mat.x + f.mat.w / 2;
  const foot = f.mat.y + f.mat.h;
  return [
    rect('panel', f.x, f.y, f.w, f.h, 1.5, T.frame),
    rect('panel', f.mat.x, f.mat.y, f.mat.w, f.mat.h, 0.5, T.mat),
    ellipse('mark', cx, f.mat.y + 12, 5.5, 5.5, T.silhouette),
    path(
      'mark',
      `M${n(cx - 10)} ${foot}C${n(cx - 10)} ${foot - 10} ${n(cx - 5)} ${foot - 14} ${cx} ${foot - 14}C${n(cx + 5)} ${foot - 14} ${n(cx + 10)} ${foot - 10} ${n(cx + 10)} ${foot}Z`,
      T.silhouette,
    ),
  ];
}

// A long wooden panel with a linen backing and a brass plate, holding two rows of four frames.
const PHOTO_WALL_VIEW: FurnitureDrawing = {
  width: 176,
  height: 112,
  parts: [
    rect('panel', 0, 6, 176, 106, 6, T.panel),
    rect('panel', 5, 12, 166, 95, 3, T.linen),
    rect('panel', 68, 0, 40, 12, 2, T.brass),
    path('rail', 'M76 6h24'),
    ...PHOTO_FRAME_RECTS.flatMap(emptyFrame),
  ],
  seats: [],
  ring: { cx: 88, cy: 60, rx: 86, ry: 52 },
};

/** The grid pieces this module draws, for OFFICE_ART. */
export const OFFICE_TEAM_ART = {
  'calendar-wall': allSides(CALENDAR_WALL_VIEW),
  'suggestion-box': allSides(SUGGESTION_BOX_VIEW),
  signpost: allSides(SIGNPOST_VIEW),
  'photo-wall': allSides(PHOTO_WALL_VIEW),
} as const;

// --- The Suggestion Box's limits ----------------------------------------------------------------------------------

/** How long a suggestion may be (team-pieces.md "Suggestion Box"). */
export const SUGGESTION_TEXT_MAX = 500;
/** How many suggestions one box holds. */
export const SUGGESTIONS_MAX = 200;
