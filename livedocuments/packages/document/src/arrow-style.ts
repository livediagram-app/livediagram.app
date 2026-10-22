import type { ArrowElement } from './index';

// Arrow appearance presets: the named thickness / arrowhead-size /
// arrowhead-shape / path-style options, their px (or marker) mappings,
// defaults, and the accessors that resolve an arrow's effective value.
// Split out of index.ts so the arrow appearance model lives in one focused
// module (alongside arrow-path.ts's geometry) rather than the schema barrel.
// Re-exported from ./index, so the public `@livedocuments/document` surface is
// unchanged.

// Named thickness presets exposed via the Palette. Storing the raw px
// in `strokeWidth` keeps the schema flexible while the UI sticks to a
// constrained set of sensible widths.
export type ArrowThickness = 'thin' | 'medium' | 'thick' | 'extra-thick';

export const ARROW_THICKNESS_PX: Record<ArrowThickness, number> = {
  thin: 1,
  medium: 2,
  thick: 4,
  'extra-thick': 7,
};

export const DEFAULT_ARROW_THICKNESS: ArrowThickness = 'medium';

export function arrowThicknessOf(arrow: ArrowElement): ArrowThickness {
  const w = arrow.strokeWidth;
  if (w === undefined) return DEFAULT_ARROW_THICKNESS;
  // Snap to the closest preset so the UI's toggle group always lights
  // up exactly one option, even for arrows created before the field
  // existed or copied from other tools.
  let best: ArrowThickness = DEFAULT_ARROW_THICKNESS;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const [name, px] of Object.entries(ARROW_THICKNESS_PX) as [ArrowThickness, number][]) {
    const delta = Math.abs(px - w);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = name;
    }
  }
  return best;
}

// Arrowhead size preset. Decoupled from line thickness so users can
// tune the head separately (e.g. a thin line with a bold arrowhead).
// Numbers are SVG marker viewport sizes — wider/taller markers render
// chunkier arrowheads regardless of the line's stroke width because
// of how `marker-end` scales independently from the path's stroke.
export type ArrowheadSize = 'small' | 'medium' | 'large' | 'extra-large';
export const ARROWHEAD_SIZE_PX: Record<ArrowheadSize, number> = {
  small: 4,
  medium: 6,
  large: 8.5,
  'extra-large': 12,
};
export const DEFAULT_ARROWHEAD_SIZE: ArrowheadSize = 'medium';

/**
 * How long a head draws on the canvas: its marker is sized in stroke widths (SVG's default
 * `markerUnits`), so the preset's px times the line's stroke width.
 */
export function arrowheadLengthPx(size: ArrowheadSize, strokeWidth: number): number {
  return ARROWHEAD_SIZE_PX[size] * strokeWidth;
}

// An unknown stored size draws as the default, as an unknown head shape does (arrowheadShapeOf).
export function arrowheadSizeOf(arrow: ArrowElement): ArrowheadSize {
  const size = arrow.arrowheadSize;
  return size !== undefined && Object.hasOwn(ARROWHEAD_SIZE_PX, size)
    ? size
    : DEFAULT_ARROWHEAD_SIZE;
}

// Arrowhead head-shape preset. `triangle` (the filled classic) is the
// default so every arrow authored before the field renders unchanged.
// The hollow / open / dot / diamond variants exist mainly for UML and
// architecture notation: hollow triangle = inheritance, open V (line)
// = dependency / flow, filled diamond = composition, hollow diamond =
// aggregation, dot = a terminal marker. The `-hollow` variants render
// white-filled with the line's stroke as outline; `line` is an open V
// with no fill. Each (shape x size) pair gets its own SVG <marker>.
export type ArrowheadShape =
  | 'triangle'
  | 'triangle-hollow'
  | 'line'
  | 'circle'
  | 'circle-hollow'
  | 'diamond'
  | 'diamond-hollow'
  // The ER ends (docs/specs/008-canvas/canvas-and-palette.md): a table's cardinality where the line meets it.
  | 'one'
  | 'zero-or-one'
  | 'many'
  | 'zero-or-many'
  | 'one-or-many';
export const ARROWHEAD_SHAPES: ArrowheadShape[] = [
  'triangle',
  'triangle-hollow',
  'line',
  'circle',
  'circle-hollow',
  'diamond',
  'diamond-hollow',
  'one',
  'zero-or-one',
  'many',
  'zero-or-many',
  'one-or-many',
];
export const DEFAULT_ARROWHEAD_SHAPE: ArrowheadShape = 'triangle';
const isArrowheadShape = (v: unknown): v is ArrowheadShape =>
  (ARROWHEAD_SHAPES as readonly unknown[]).includes(v);
// The head an arrow draws. A stored shape this build does not know (a newer build's, or a hand-edited file) draws
// as the default, as the validator leaves cosmetic values for the renderer to read.
export function arrowheadShapeOf(arrow: ArrowElement): ArrowheadShape {
  return isArrowheadShape(arrow.arrowheadShape) ? arrow.arrowheadShape : DEFAULT_ARROWHEAD_SHAPE;
}
// The start's head: its own when it differs (an ER relationship's two cardinalities), else the end's.
export function arrowheadStartShapeOf(arrow: ArrowElement): ArrowheadShape {
  return isArrowheadShape(arrow.arrowheadStartShape)
    ? arrow.arrowheadStartShape
    : arrowheadShapeOf(arrow);
}

// Path geometry preset. Straight is the existing behaviour; curved
// adds a perpendicular bow via a quadratic Bezier; angled draws an
// axis-aligned right-angle elbow between the two endpoints. Stored
// as a named preset so the renderer can swap geometries without
// touching the data model.
export type ArrowStyle = 'straight' | 'curved' | 'angled';
const DEFAULT_ARROW_STYLE: ArrowStyle = 'straight';
export function arrowStyleOf(arrow: ArrowElement): ArrowStyle {
  const style = arrow.arrowStyle;
  return style === 'curved' || style === 'angled' ? style : DEFAULT_ARROW_STYLE;
}
