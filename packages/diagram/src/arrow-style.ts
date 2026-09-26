import type { ArrowElement } from './index';

// Arrow appearance presets: the named thickness / arrowhead-size /
// arrowhead-shape / path-style options, their px (or marker) mappings,
// defaults, and the accessors that resolve an arrow's effective value.
// Split out of index.ts so the arrow appearance model lives in one focused
// module (alongside arrow-path.ts's geometry) rather than the schema barrel.
// Re-exported from ./index, so the public `@livediagram/diagram` surface is
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

export function arrowheadSizeOf(arrow: ArrowElement): ArrowheadSize {
  return arrow.arrowheadSize ?? DEFAULT_ARROWHEAD_SIZE;
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
  | 'diamond-hollow';
export const ARROWHEAD_SHAPES: ArrowheadShape[] = [
  'triangle',
  'triangle-hollow',
  'line',
  'circle',
  'circle-hollow',
  'diamond',
  'diamond-hollow',
];
export const DEFAULT_ARROWHEAD_SHAPE: ArrowheadShape = 'triangle';
export function arrowheadShapeOf(arrow: ArrowElement): ArrowheadShape {
  return arrow.arrowheadShape ?? DEFAULT_ARROWHEAD_SHAPE;
}

// Path geometry preset. Straight is the existing behaviour; curved
// adds a perpendicular bow via a quadratic Bezier; angled draws an
// axis-aligned right-angle elbow between the two endpoints. Stored
// as a named preset so the renderer can swap geometries without
// touching the data model.
export type ArrowStyle = 'straight' | 'curved' | 'angled';
const DEFAULT_ARROW_STYLE: ArrowStyle = 'straight';
export function arrowStyleOf(arrow: ArrowElement): ArrowStyle {
  return arrow.arrowStyle ?? DEFAULT_ARROW_STYLE;
}
