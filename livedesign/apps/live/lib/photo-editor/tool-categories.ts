// The palette strip's photo tools (docs/specs/031-photo/photo-pages.md "The photo tools"): the few used most stay as
// buttons on the strip (PINNED_GROUPS); every tool is also in a category by what it is for (STRIP_CATEGORIES), a
// button with its name opening a flyout of the category's tool groups, a group of several opening its tools beside
// it (or, for a group the category lists flat, each of its tools as a row of its own).
import type { PhotoToolId } from './tool-state';

export const PINNED_GROUPS: readonly string[] = [
  'move',
  'marquee',
  'brush',
  'eraser',
  'crop',
  'type',
];

export type StripCategory = {
  id: string;
  name: string;
  tagline: string;
  // The tool whose glyph the category shows.
  icon: PhotoToolId;
  groups: readonly string[];
  // Groups whose tools are listed as rows of their own, with no panel beside: a category with room for them.
  flat?: readonly string[];
};

export const STRIP_CATEGORIES: readonly StripCategory[] = [
  {
    id: 'select',
    name: 'Select',
    tagline: 'Choose the part of the photo to work on.',
    icon: 'lasso',
    groups: ['marquee', 'lasso', 'smart'],
  },
  {
    id: 'paint',
    name: 'Paint',
    tagline: 'Brushes, erasers, fills and picking colours.',
    icon: 'gradient',
    groups: ['brush', 'eraser', 'fill', 'eyedropper'],
  },
  {
    id: 'retouch',
    name: 'Retouch',
    tagline: 'Heal, clone, sharpen and touch up.',
    icon: 'spot-heal',
    groups: ['heal', 'clone', 'focus', 'tone'],
  },
  {
    id: 'shapes',
    name: 'Shapes',
    tagline: 'Text and shapes drawn into the picture.',
    icon: 'rectangle',
    groups: ['type', 'shape'],
    flat: ['shape'],
  },
];

// What each group of several tools holds, for its row's line.
export const GROUP_BLURBS: Readonly<Record<string, string>> = {
  marquee: 'Rectangles and ellipses.',
  lasso: 'Freehand, point to point, or snapping to edges.',
  smart: 'Paint or click to select alike areas.',
  brush: 'Soft brush or hard pencil.',
  eraser: 'Rub out, or rub out a background colour.',
  fill: 'A gradient or a flood of colour.',
  heal: 'Blend away spots, flaws and red eye.',
  focus: 'Blur, sharpen or smudge.',
  tone: 'Lighten, darken or change saturation.',
  shape: 'Rectangles, ellipses and lines.',
};
