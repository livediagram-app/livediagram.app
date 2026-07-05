// "Show me around" guided-tour builder (spec/69). A small sample scene
// whose annotation markers (spec/38) teach the core interactions in
// place: a mini flow of connected shapes, a sticky note, and one marker
// beside each thing it explains. Every note describes a real, shipped
// interaction; if an interaction changes, this copy changes in the same
// PR. No colours are set here so the applied theme owns them.

import {
  createAnnotation,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  type Element,
} from '@livediagram/diagram';

// The title block, the three-node flow, and the sticky anchor the scene;
// each annotation sits beside the element its note explains.
const TITLE = { x: -260, y: -300, w: 520, h: 60 };
const CAPTION = { x: -260, y: -234, w: 520, h: 40 };
const NODE = { w: 170, h: 90 };
const NODE_Y = -80;
const NODE_XS = [-450, -85, 280];
const STICKY = { x: -450, y: 90, w: 200, h: 200 };

// Annotation placements + their teaching notes, in reading order.
const MARKERS: { x: number; y: number; note: string }[] = [
  {
    x: 292,
    y: -296,
    note: 'Everything here came from the Palette panel. Tap a tile to drop an element, or drag on the canvas to draw it at the size you want.',
  },
  {
    x: -22,
    y: -148,
    note: 'Click a shape to select it, and double-click to edit its label. Drag it around and watch its arrows follow.',
  },
  {
    x: 176,
    y: -57,
    note: 'Hover a shape and drag one of the + handles that appear to draw an arrow to another shape. Arrows stay pinned to both ends.',
  },
  {
    x: -228,
    y: 122,
    note: 'Right-click any element to change its colours, border, layer order and more.',
  },
  {
    x: 292,
    y: 152,
    note: 'Changed your mind? Press Ctrl/Cmd+Z to undo, or use the undo buttons at the bottom of the Palette.',
  },
];

export function buildGuidedTour(cx: number, cy: number): Element[] {
  const elements: Element[] = [];

  elements.push({
    ...createText(cx + TITLE.x, cy + TITLE.y),
    width: TITLE.w,
    height: TITLE.h,
    label: 'Welcome to livediagram',
    textSize: 'scale',
    textBold: true,
  });
  elements.push({
    ...createText(cx + CAPTION.x, cy + CAPTION.y),
    width: CAPTION.w,
    height: CAPTION.h,
    label: 'Hover the small round markers to learn the basics, then try things out.',
    textSize: 'sm',
  });

  // The three-node flow. Labels double as invitations to interact.
  const node = (shape: 'square' | 'stadium', x: number, label: string) => ({
    ...createShape(shape, cx + x, cy + NODE_Y),
    width: NODE.w,
    height: NODE.h,
    label,
  });
  const [x1, x2, x3] = NODE_XS as [number, number, number];
  const start = node('square', x1, 'Start here');
  const middle = node('square', x2, 'Drag me around');
  const end = node('stadium', x3, 'Double-click me');
  elements.push(start, middle, end);
  elements.push(createPinnedArrow(start.id, 'e', middle.id, 'w'));
  elements.push(createPinnedArrow(middle.id, 'e', end.id, 'w'));

  elements.push({
    ...createSticky(cx + STICKY.x, cy + STICKY.y),
    width: STICKY.w,
    height: STICKY.h,
    label: 'Sticky notes are perfect for quick thoughts.',
  });

  for (const m of MARKERS) {
    elements.push({ ...createAnnotation(cx + m.x, cy + m.y), note: m.note });
  }

  return elements;
}
