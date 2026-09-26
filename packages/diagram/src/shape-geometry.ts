// The one geometry table for the shapes that are DRAWN rather than boxed.
//
// Two renderers paint these: the editor's React overlays (ShapeSvgOverlay,
// BrowserChrome, ChairView in apps/live) and the headless string emitters
// (svg-render-shapes / svg-render-faces here, used by exports, thumbnails,
// the api's live image and the MCP render). They used to carry their own
// copies of every path, kept "in sync" by a comment, and the copies drifted
// (a frame that took its fill on the canvas exported empty; a chair lost its
// facing and its seat in an export). Both now read the data below, so a
// silhouette changes in one place. Pure data + pure functions: no React, no
// DOM, safe in a worker.
//
// How a part is painted is its ROLE, which both renderers map to the same
// attributes:
//   - main:    the element's fill + stroke + border dash, round joins
//   - outline: the same without round joins (the frame's sharp corners)
//   - detail:  thin solid chrome (bezels, keys, creases), no fill
//   - limb:    an unfilled round-capped line (the actor's body)
//   - head:    a limb that takes the element's fill (the actor's head)
import type { ChairFacing } from './collab-shapes';
import { colorWash } from './color-wash';
import type { ShapeKind } from './shape-kind';

export type ShapePartRole = 'main' | 'outline' | 'detail' | 'limb' | 'head';

export type ShapePart =
  | { tag: 'path'; role: ShapePartRole; d: string }
  | { tag: 'polygon'; role: ShapePartRole; points: string }
  | {
      tag: 'rect';
      role: ShapePartRole;
      x: number;
      y: number;
      width: number;
      height: number;
      rx?: number;
    }
  | { tag: 'ellipse'; role: ShapePartRole; cx: number; cy: number; rx: number; ry: number }
  | { tag: 'circle'; role: ShapePartRole; cx: number; cy: number; r: number };

export type ShapeGeometry = {
  viewBox: string;
  // `none` stretches the art to the element box; `meet` keeps it
  // proportional (the actor, who would otherwise turn into a smear).
  preserveAspectRatio: 'none' | 'xMidYMid meet';
  parts: readonly ShapePart[];
};

// The thin stroke every `detail` part draws at, in screen pixels.
export const SHAPE_DETAIL_STROKE_PX = 0.8;

const STRETCH = '0 0 100 100';

const stretch = (...parts: ShapePart[]): ShapeGeometry => ({
  viewBox: STRETCH,
  preserveAspectRatio: 'none',
  parts,
});
const polygon = (points: string, role: ShapePartRole = 'main'): ShapePart => ({
  tag: 'polygon',
  role,
  points,
});
const path = (d: string, role: ShapePartRole = 'main'): ShapePart => ({ tag: 'path', role, d });
const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  rx?: number,
  role: ShapePartRole = 'main',
): ShapePart => ({ tag: 'rect', role, x, y, width, height, ...(rx !== undefined ? { rx } : {}) });

// The diamond's vertices, exported on their own because the headless render
// draws it natively at element coordinates rather than as a nested <svg>.
export const DIAMOND_POINTS = '50,0 100,50 50,100 0,50';

/** The actor's anchoring hull in its 0..90 x 0..130 viewBox
 *  (docs/specs/008-canvas/arrow-anchors.md): the convex hull of the head, the
 *  arm tips and the feet, carried down to the bottom of the label band so a
 *  connector below the figure clears its caption. Clockwise from the top. */
export const ACTOR_HULL: readonly (readonly [number, number])[] = [
  [45, 6],
  [56.3, 10.7],
  [61, 22],
  [74, 56],
  [68, 130],
  [22, 130],
  [16, 56],
  [29, 22],
  [33.7, 10.7],
];
export const ACTOR_VIEWBOX = { width: 90, height: 130 } as const;

// Every silhouette whose geometry does not depend on the element's size.
const FIXED_GEOMETRY: Partial<Record<ShapeKind, ShapeGeometry>> = {
  diamond: stretch(polygon(DIAMOND_POINTS)),
  parallelogram: stretch(polygon('20,0 100,0 80,100 0,100')),
  hexagon: stretch(polygon('25,0 75,0 100,50 75,100 25,100 0,50')),
  document: stretch(path('M 0 0 L 100 0 L 100 92 C 80 109, 65 79, 50 94 C 35 109, 20 79, 0 94 Z')),
  cylinder: stretch(path('M 0 15 L 100 15 L 100 85 A 50 12 0 0 1 0 85 Z'), {
    tag: 'ellipse',
    role: 'main',
    cx: 50,
    cy: 15,
    rx: 50,
    ry: 12,
  }),
  // Normalised to fill the full 0..100 box (an earlier cut sat in x 12.7..90
  // and could not be lined up against its neighbours). Control points fall
  // outside the box by design: the curve itself reaches the edges.
  cloud: stretch(
    path(
      'M 22.4 100 C 1.7 100, -7.3 71.2, 6.9 55 C -2.2 31.5, 17.2 11.7, 31.4 24.3 C 36.6 -6.3, 70.2 -9.9, 74.1 24.3 C 92.1 11.7, 107.6 38.8, 93.4 58.6 C 107.6 73, 97.3 100, 76.6 100 Z',
    ),
  ),
  triangle: stretch(polygon('50,2 98,98 2,98')),
  trapezoid: stretch(polygon('22,4 78,4 98,96 2,96')),
  star: stretch(polygon('50,2 61,35 96,35 68,56 78,89 50,69 22,89 32,56 4,35 39,35')),
  // The rounded body fills the WHOLE box so a centred label lands in the
  // bubble; the tail hangs below it (y > 100), let through by overflow.
  'speech-bubble': stretch(
    path(
      'M 8 0 L 92 0 A 8 8 0 0 1 100 8 L 100 92 A 8 8 0 0 1 92 100 L 44 100 L 26 120 L 34 100 L 8 100 A 8 8 0 0 1 0 92 L 0 8 A 8 8 0 0 1 8 0 Z',
    ),
  ),
  // Section container. Sharp corners (an rx would warp under the stretch),
  // and it takes the element's fill like every other shape: a frame defaults
  // to transparent, so the see-through look is the default, not a rule.
  frame: stretch(rect(1, 1, 98, 98, undefined, 'outline')),
  // Screen on top, trapezoid stand below.
  monitor: stretch(rect(1, 1, 98, 80, 3), path('M 32 88 L 68 88 L 76 99 L 24 99 Z')),
  // Heavy corners are the tell of "phone"; the inset line is the bezel.
  phone: stretch(rect(2, 2, 96, 96, 10), rect(6, 10, 88, 80, 3, 'detail')),
  // The phone's skeleton with a thinner bezel and gentler corners.
  tablet: stretch(rect(2, 2, 96, 96, 6), rect(5, 6, 90, 88, 3, 'detail')),
  // Unfolded: the crease down the middle is what says "not a tablet".
  foldable: stretch(
    rect(2, 2, 96, 96, 5),
    rect(5, 6, 90, 88, 3, 'detail'),
    path('M 50 6 L 50 94', 'detail'),
  ),
  // Straps above and below, a crown on the right, the face, its bezel.
  smartwatch: stretch(
    rect(36, 0, 28, 20),
    rect(36, 80, 28, 20),
    rect(76, 43, 7, 14, 2),
    rect(22, 14, 56, 72, 14),
    rect(29, 21, 42, 58, 9, 'detail'),
  ),
  // UML actor: an open head over a line body. The viewBox leaves a small
  // clear band under the legs (y 112..130) for the label.
  actor: {
    viewBox: `0 0 ${ACTOR_VIEWBOX.width} ${ACTOR_VIEWBOX.height}`,
    preserveAspectRatio: 'xMidYMid meet',
    parts: [
      { tag: 'circle', role: 'head', cx: 45, cy: 22, r: 16 },
      path('M 45 38 L 45 82', 'limb'),
      path('M 16 56 L 74 56', 'limb'),
      path('M 45 82 L 22 112', 'limb'),
      path('M 45 82 L 68 112', 'limb'),
    ],
  },
};

/** A single-path silhouette's `d` in its 0..100 box, or null for a kind not
 *  drawn as one path. Anchor projection samples it (cloud, document). */
export function shapePathData(kind: ShapeKind): string | null {
  const parts = FIXED_GEOMETRY[kind]?.parts;
  const only = parts?.length === 1 ? parts[0] : undefined;
  return only?.tag === 'path' ? only.d : null;
}

/** A single-polygon silhouette's vertices in its 0..100 box (which equals
 *  CSS percentages), or null for a kind not drawn as one polygon. For the
 *  consumers that need the outline itself rather than a drawing: anchor
 *  projection (geometry.ts) and the isometric clip (apps/live isometric.ts). */
export function shapePolygonVertices(kind: ShapeKind): [number, number][] | null {
  const parts = FIXED_GEOMETRY[kind]?.parts;
  const only = parts?.length === 1 ? parts[0] : undefined;
  if (only?.tag !== 'polygon') return null;
  return only.points.split(' ').map((pt) => pt.split(',').map(Number) as [number, number]);
}

// Open-clamshell laptop: lid with an even display bezel, a slim hinge, a
// keyboard deck, a generated key grid, spacebar and trackpad. The bezel is
// the one size-dependent mark: the stretch lands equal viewBox insets
// unevenly, so the horizontal inset scales by 1/aspect (H/W) to keep the
// margin even in screen pixels.
function laptopGeometry(aspect: number): ShapeGeometry {
  const lid = { x: 8, y: 2, w: 84, h: 60 };
  const insetY = 3;
  const insetX = Math.max(1, Math.min(8, insetY / aspect));
  // A rectangle that fits inside the trapezoid deck at every row.
  const kb = { left: 20, right: 80, top: 69, bottom: 84 };
  const cols = 12;
  const rows = 4;
  const cellW = (kb.right - kb.left) / cols;
  const cellH = (kb.bottom - kb.top) / rows;
  const gapX = cellW * 0.2;
  const gapY = cellH * 0.22;
  const keys: ShapePart[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      keys.push(
        rect(
          kb.left + c * cellW + gapX / 2,
          kb.top + r * cellH + gapY / 2,
          cellW - gapX,
          cellH - gapY,
          0.6,
          'detail',
        ),
      );
    }
  }
  return stretch(
    rect(lid.x, lid.y, lid.w, lid.h, 4),
    rect(lid.x + insetX, lid.y + insetY, lid.w - insetX * 2, lid.h - insetY * 2, 2, 'detail'),
    rect(lid.x + 2, lid.y + lid.h, lid.w - 4, 3, 1.5),
    path('M 14 66 L 86 66 L 94 96 L 6 96 Z'),
    ...keys,
    rect(38, 85.5, 24, 3, 0.8, 'detail'),
    rect(43, 90, 14, 4, 1, 'detail'),
  );
}

/** Every kind this table draws. */
export const SHAPE_GEOMETRY_KINDS: readonly ShapeKind[] = [
  ...(Object.keys(FIXED_GEOMETRY) as ShapeKind[]),
  'laptop',
];

/** A kind's drawn geometry, or null for a kind drawn some other way (a CSS
 *  box, a self-painting face). `aspect` is the element's width / height; only
 *  the laptop reads it. */
export function shapeGeometry(kind: ShapeKind, aspect = 1.6): ShapeGeometry | null {
  if (kind === 'laptop') return laptopGeometry(aspect > 0 && Number.isFinite(aspect) ? aspect : 1);
  return FIXED_GEOMETRY[kind] ?? null;
}

// A browser frame's chrome strip (docs/specs/008-canvas/canvas-and-palette.md Devices), in fixed PIXELS rather
// than a stretched viewBox so the dots stay round and the URL pill grows with
// the width. The strip is pinned to the top: [pad][3 dots][gap][nav][gap][pill][pad].
export const BROWSER_CHROME = {
  heightPx: 48,
  padXPx: 16,
  dotPx: 12,
  dotGapPx: 6,
  groupGapPx: 10,
  pillHeightPx: 20,
  nav: {
    viewBox: '0 0 44 14',
    widthPx: 56,
    heightPx: 18,
    strokeWidth: 1.6,
    // Back, forward, reload.
    paths: [
      'M 7 3 L 3 7 L 7 11',
      'M 15 11 L 19 7 L 15 3',
      'M 30 4 A 4 4 0 1 1 27 11 M 30 4 L 33 4 M 30 4 L 30 7',
    ],
  },
} as const;

/** Where each mark of the chrome strip starts, in px from the strip's left. */
export function browserChromeLayout(): { dotX: number[]; navX: number; pillX: number } {
  const c = BROWSER_CHROME;
  const dotX = [0, 1, 2].map((i) => c.padXPx + i * (c.dotPx + c.dotGapPx));
  const navX = c.padXPx + 3 * c.dotPx + 2 * c.dotGapPx + c.groupGapPx;
  return { dotX, navX, pillX: navX + c.nav.widthPx + c.groupGapPx };
}

// The chair (docs/specs/009-elements/chair.md), on its own 64x72 grid, drawn facing 'n' (back at the
// top) and turned whole for the other facings.
export const CHAIR_GEOMETRY = {
  viewBox: '0 0 64 72',
  // Contact shadow, so the chair sits ON the canvas.
  shadow: { cx: 32, cy: 66, rx: 19, ry: 4, fill: '#0f172a', opacity: 0.12 },
  // Tall backrest, so the silhouette reads as a chair and not two pills.
  back: { x: 17, y: 3, width: 30, height: 31, rx: 4 },
  // The slat down the back and the stretcher between the legs: faint rails.
  slat: 'M32 8v21',
  stretcher: 'M15 57h34',
  // Seat: a shallow slab wider than the back.
  seat: { x: 10, y: 34, width: 44, height: 13, rx: 3 },
  legs: 'M15 47v16M49 47v16',
  // The occupied ring, on the seat where the sitter's feet land (canvas only:
  // presence is not in the element, so a still render never has a sitter).
  ring: { cx: 32, cy: 40, rx: 24, ry: 10 },
  panelStrokeWidth: 2,
  legStrokeWidth: 2.5,
  railStrokeWidth: 1.5,
  railOpacity: 0.5,
} as const;

export const CHAIR_FACING_ROTATION: Record<ChairFacing, number> = { n: 0, e: 90, s: 180, w: 270 };

/** A chair's seat colour: its own fill, or with none (the default is
 *  `transparent`) a wash of its stroke, so it follows the tab theme rather
 *  than staying a fixed light grey on a dark board. */
export function chairSeatFill(fillColor: string | undefined, stroke: string): string {
  return fillColor && fillColor !== 'transparent' ? fillColor : colorWash(stroke, 0.32);
}
