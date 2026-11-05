// The one geometry table for the shapes that are DRAWN rather than boxed.
//
// Two renderers paint these: the editor's React overlays (ShapeSvgOverlay,
// BrowserChrome, FurnitureView in apps/editor) and the headless string emitters
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
import { colorWash } from '@liveworkspace/model-core/color-wash';
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
      // Only set once a part is mapped into a box (svg-shape-fit.ts), where a
      // stretch turns round corners elliptical; the table itself never uses it.
      ry?: number;
    }
  | { tag: 'ellipse'; role: ShapePartRole; cx: number; cy: number; rx: number; ry: number }
  | { tag: 'circle'; role: ShapePartRole; cx: number; cy: number; r: number };

export type ShapeGeometry = {
  viewBox: string;
  // `none` stretches the art to the element box; `meet` keeps it
  // proportional (the actor, who would otherwise turn into a smear).
  preserveAspectRatio: 'none' | 'xMidYMid meet';
  parts: readonly ShapePart[];
  // The art is drawn into the box inset by half the stroke, so the stroke
  // stays inside the box as a CSS border does (the diamond's tips would
  // otherwise poke past the edge a square of the same box draws). Set on
  // every silhouette whose outline touches the box edge.
  strokeInside?: true;
};

// The thin stroke every `detail` part draws at, in screen pixels.
export const SHAPE_DETAIL_STROKE_PX = 0.8;

const STRETCH = '0 0 100 100';

const stretch = (...parts: ShapePart[]): ShapeGeometry => ({
  viewBox: STRETCH,
  preserveAspectRatio: 'none',
  parts,
});
const strokeInside = (geometry: ShapeGeometry): ShapeGeometry => ({
  ...geometry,
  strokeInside: true,
});
const polygon = (points: string, role: ShapePartRole = 'main'): ShapePart => ({
  tag: 'polygon',
  role,
  points,
});
const path = (d: string, role: ShapePartRole = 'main'): ShapePart => ({ tag: 'path', role, d });

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
  diamond: strokeInside(stretch(polygon(DIAMOND_POINTS))),
  parallelogram: strokeInside(stretch(polygon('20,0 100,0 80,100 0,100'))),
  hexagon: strokeInside(stretch(polygon('25,0 75,0 100,50 75,100 25,100 0,50'))),
  document: strokeInside(
    stretch(path('M 0 0 L 100 0 L 100 92 C 80 109, 65 79, 50 94 C 35 109, 20 79, 0 94 Z')),
  ),
  cylinder: strokeInside(
    stretch(path('M 0 15 L 100 15 L 100 85 A 50 12 0 0 1 0 85 Z'), {
      tag: 'ellipse',
      role: 'main',
      cx: 50,
      cy: 15,
      rx: 50,
      ry: 12,
    }),
  ),
  // Normalised to fill the full 0..100 box (an earlier cut sat in x 12.7..90
  // and could not be lined up against its neighbours). Control points fall
  // outside the box by design: the curve itself reaches the edges.
  cloud: strokeInside(
    stretch(
      path(
        'M 22.4 100 C 1.7 100, -7.3 71.2, 6.9 55 C -2.2 31.5, 17.2 11.7, 31.4 24.3 C 36.6 -6.3, 70.2 -9.9, 74.1 24.3 C 92.1 11.7, 107.6 38.8, 93.4 58.6 C 107.6 73, 97.3 100, 76.6 100 Z',
      ),
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
  // UML final state: a ring (the line colour, unfilled) round a solid dot (the fill), kept round in any box.
  'final-state': {
    viewBox: '0 0 100 100',
    preserveAspectRatio: 'xMidYMid meet',
    parts: [
      { tag: 'circle', role: 'limb', cx: 50, cy: 50, r: 46 },
      { tag: 'circle', role: 'head', cx: 50, cy: 50, r: 27 },
    ],
  },
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
 *  projection (geometry.ts) and the isometric clip (apps/editor isometric.ts). */
export function shapePolygonVertices(kind: ShapeKind): [number, number][] | null {
  const parts = FIXED_GEOMETRY[kind]?.parts;
  const only = parts?.length === 1 ? parts[0] : undefined;
  if (only?.tag !== 'polygon') return null;
  return only.points.split(' ').map((pt) => pt.split(',').map(Number) as [number, number]);
}

/** Every kind this table draws. */
export const SHAPE_GEOMETRY_KINDS: readonly ShapeKind[] = Object.keys(
  FIXED_GEOMETRY,
) as ShapeKind[];

/** A kind's drawn geometry, or null for a kind drawn some other way (a CSS
 *  box, a self-painting face). */
export function shapeGeometry(kind: ShapeKind): ShapeGeometry | null {
  return FIXED_GEOMETRY[kind] ?? null;
}

/** A chair's seat colour: its own fill, or with none (the default is
 *  `transparent`) a wash of its stroke, so it follows the tab theme rather
 *  than staying a fixed light grey on a dark canvas. */
export function chairSeatFill(fillColor: string | undefined, stroke: string): string {
  return fillColor && fillColor !== 'transparent' ? fillColor : colorWash(stroke, 0.32);
}
