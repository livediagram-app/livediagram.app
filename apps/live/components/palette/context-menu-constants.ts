import type { BorderRadius, BorderStroke, BorderStyle, ShapeKind } from '@livediagram/diagram';

// Curated subset of the most common shapes offered for in-place morphing in
// the context menu's Shape category (the full set lived in the old panel).
export const COMMON_SHAPES: ShapeKind[] = [
  'square',
  'circle',
  'diamond',
  'stadium',
  'parallelogram',
  'hexagon',
  'triangle',
  'cylinder',
];

// Fixed rotation angles offered in the Rotation category (and the search
// palette's Rotate actions). 0 doubles as "reset to upright". These 45° steps
// are the only way to rotate — there's no free-drag rotate handle.
export const ROTATION_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

// Border option sets rendered in the menu's Border section. Shared by the
// element and multi-selection branches.
export const BORDER_STROKES: readonly BorderStroke[] = [
  'none',
  'thin',
  'medium',
  'thick',
  'extra-thick',
];
export const BORDER_STYLES: readonly BorderStyle[] = [
  'solid',
  'dashed',
  'dotted',
  'dash-dot',
  'long-dash',
  'dash-dot-dot',
];
export const BORDER_RADII: readonly BorderRadius[] = ['none', 'sm', 'md', 'lg', 'full'];
