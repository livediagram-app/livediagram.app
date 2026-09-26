// Border styling presets (stroke weight / dash style / corner radius) shared
// by shapes and arrows: the small named unions plus their px / dasharray maps
// and defaults. Split out of index.ts so the border appearance model lives in
// one focused module (alongside arrow-style.ts and arrow-path.ts). Re-exported
// from ./index, so the public `@livediagram/diagram` surface is unchanged.

// Border styling presets. Keep these as small unions so the
// CommandPalette can render them as 3-to-4-button icon rows that
// match the Pointer accordion's pattern (Line thickness /
// Arrowhead size / etc).
export type BorderStroke = 'none' | 'thin' | 'medium' | 'thick' | 'extra-thick';
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'long-dash' | 'dash-dot-dot';
export type BorderRadius = 'none' | 'sm' | 'md' | 'lg' | 'full';

export const BORDER_STROKE_PX: Record<BorderStroke, number> = {
  none: 0,
  thin: 1,
  medium: 2,
  thick: 4,
  'extra-thick': 7,
};

// Default for shapes that don't carry a strokeWidth field. Picked to
// match what the renderer was hardcoding before this field existed
// so old diagrams render exactly the same.
export const DEFAULT_BORDER_STROKE: BorderStroke = 'medium';

// SVG `stroke-dasharray` values in absolute user units, applied
// directly by the renderer (shapes + arrows). 'solid' maps to no
// dasharray (omit the attribute) so the default solid stroke path
// stays the same.
export const BORDER_DASH_ARRAY: Record<BorderStyle, string | null> = {
  solid: null,
  // Tuned so each pattern reads as distinct at a glance: short even
  // dashes vs tiny dots vs clearly-longer dashes vs the dash/dot
  // composites (whose dash segment is longer than plain `dashed` so
  // the two never look alike).
  dashed: '6 5',
  dotted: '1 4',
  'long-dash': '18 7',
  'dash-dot': '10 5 1 5',
  'dash-dot-dot': '10 5 1 5 1 5',
};

export const DEFAULT_BORDER_STYLE: BorderStyle = 'solid';

// Corner radius in pixels. Only meaningful on shapes whose silhouette
// has user-visible corners (square / stadium and the device frames);
// the SVG-overlay shapes (diamond, hexagon, cloud etc) ignore it.
export const BORDER_RADIUS_PX: Record<BorderRadius, number> = {
  none: 0,
  sm: 4,
  md: 12,
  lg: 24,
  // Pill / circle: a radius far larger than any element half-size. CSS clamps
  // border-radius to 50% of the box, so this renders a square as a circle and
  // a rectangle as a stadium — what a circular avatar (docs/specs/008-canvas/canvas-and-palette.md) needs.
  full: 9999,
};
