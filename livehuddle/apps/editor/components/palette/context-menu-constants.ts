import type { BorderStroke, BorderStyle } from '@livehuddle/document';

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
