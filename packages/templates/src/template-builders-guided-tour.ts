// "Show me around" guided-tour builder (spec/69). A poster-composed
// sample scene whose annotation markers (spec/38) teach the core
// interactions in place: a header, a connected flow to poke at, a
// "Make it yours" styling cluster, a Pencil sketch, and a "Beyond
// boxes" data cluster, with one marker beside each thing it explains.
// Every note describes a real, shipped interaction; if an interaction
// changes, this copy changes in the same PR. Only decorative accents
// set colours; the applied theme owns the rest.

import {
  createAnnotation,
  createFreehand,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  type Element,
} from '@livediagram/diagram';

// --- Layout ----------------------------------------------------------
// One coordinate table so the composition is legible at a glance:
// a centred header, the interactive flow row beneath it, then three
// feature clusters (styling left, sketch centre, data right) and the
// teaching markers pinned beside their subjects.
const TITLE = { x: -300, y: -390, w: 600, h: 60 };
const CAPTION = { x: -300, y: -322, w: 600, h: 36 };
const NODE = { w: 170, h: 90 };
const FLOW_Y = -220;
const START_X = -600;
const MIDDLE_X = -235;
const END_X = 130;
const DIAMOND = { x: 470, y: -235, w: 160, h: 120 };
const LEFT_HEAD = { x: -600, y: -70, w: 240, h: 30 };
const STICKY = { x: -600, y: -10, w: 190, h: 190 };
const CIRCLE = { x: -360, y: -10, w: 120, h: 120 };
const BLOCKED = { x: -360, y: 140, w: 150, h: 80 };
const RIGHT_HEAD = { x: 260, y: -70, w: 240, h: 30 };
const BAR = { x: 260, y: -10 };
const RING = { x: 520, y: -30 };
const STARS = { x: 260, y: 70, w: 220, h: 44 };
// The Pencil wave: a hand-drawn sine ribbon between the two clusters.
const WAVE = { x: -140, y: 90, span: 250, amp: 34, steps: 36 };

// Annotation placements + their teaching notes, in reading order. Kept
// to one marker per lesson so the scene reads as guided, not littered.
const MARKERS: { x: number; y: number; note: string }[] = [
  {
    x: -364,
    y: -382,
    note: 'Everything on this canvas came from the Palette. Tap a tile to drop an element, or drag on the canvas to draw it at the size you want.',
  },
  {
    x: -172,
    y: -290,
    note: 'Click a shape to select it, and double-click to edit its label. Drag it around and watch its arrows follow.',
  },
  {
    x: 335,
    y: -145,
    note: 'Hover a shape and drag one of the + handles that appear to draw an arrow. Right-click an arrow for curves, elbows, dashes, arrowheads and animated flow.',
  },
  {
    x: -212,
    y: 20,
    note: 'Right-click any element to change its colours, border, layers and more. The status dots on these two are shape markers.',
  },
  {
    x: 128,
    y: 30,
    note: 'This squiggle came from the Pencil tool (press P). Turn on shape recognition and your sketches snap into clean shapes.',
  },
  {
    x: 500,
    y: 130,
    note: "More than boxes: progress bars, star ratings, pie charts and full icon sets live in the Palette's categories.",
  },
  {
    x: -30,
    y: 250,
    note: 'Right-click empty canvas to change the theme, and everything recolours to match. Made a mess? Press Ctrl/Cmd+Z to undo, or use the buttons at the bottom of the Palette.',
  },
  {
    x: 322,
    y: -382,
    note: 'Bigger ideas? Add tabs from the bar at the bottom. And when you are ready, Share (top right) gives you a live link anyone can join.',
  },
];

export function buildGuidedTour(cx: number, cy: number): Element[] {
  const elements: Element[] = [];

  // Header.
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
    label: 'Hover the small round markers to learn the basics, then make this canvas yours.',
    textSize: 'sm',
  });

  // The interactive flow row. Labels double as invitations to interact;
  // the last hop shows off a labelled curved arrow with animated flow.
  const node = (shape: 'square' | 'stadium', x: number, label: string) => ({
    ...createShape(shape, cx + x, cy + FLOW_Y),
    width: NODE.w,
    height: NODE.h,
    label,
  });
  const start = node('square', START_X, 'Start here');
  const middle = node('square', MIDDLE_X, 'Drag me around');
  const end = node('stadium', END_X, 'Double-click me');
  const branch = {
    ...createShape('diamond', cx + DIAMOND.x, cy + DIAMOND.y),
    width: DIAMOND.w,
    height: DIAMOND.h,
    label: 'Branch out',
  };
  elements.push(start, middle, end, branch);
  elements.push(createPinnedArrow(start.id, 'e', middle.id, 'w'));
  elements.push(createPinnedArrow(middle.id, 'e', end.id, 'w'));
  elements.push({
    ...createPinnedArrow(end.id, 'e', branch.id, 'w'),
    label: 'curves too',
    arrowStyle: 'curved' as const,
    flow: 'dashes' as const,
  });

  // "Make it yours": sticky (tilted, like a real board), plus two shapes
  // carrying status shape-markers (spec/49) so the styling note has a
  // concrete thing to point at.
  elements.push({
    ...createText(cx + LEFT_HEAD.x, cy + LEFT_HEAD.y),
    width: LEFT_HEAD.w,
    height: LEFT_HEAD.h,
    label: 'Make it yours',
    textSize: 'sm',
    textBold: true,
  });
  elements.push({
    ...createSticky(cx + STICKY.x, cy + STICKY.y),
    width: STICKY.w,
    height: STICKY.h,
    label: 'Sticky notes are perfect for quick thoughts.',
    rotation: -3,
  });
  elements.push({
    ...createShape('circle', cx + CIRCLE.x, cy + CIRCLE.y),
    width: CIRCLE.w,
    height: CIRCLE.h,
    label: 'Done',
    marker: 'green-circle' as const,
  });
  elements.push({
    ...createShape('square', cx + BLOCKED.x, cy + BLOCKED.y),
    width: BLOCKED.w,
    height: BLOCKED.h,
    label: 'Blocked',
    marker: 'red-circle' as const,
    strokeStyle: 'dashed' as const,
  });

  // The Pencil sketch: a smooth sine ribbon, generated (not random) so
  // the build stays deterministic and translation-invariant.
  const wavePoints = Array.from({ length: WAVE.steps + 1 }, (_, i) => ({
    x: cx + WAVE.x + (i / WAVE.steps) * WAVE.span,
    y: cy + WAVE.y + Math.sin((i / WAVE.steps) * Math.PI * 3) * WAVE.amp,
  }));
  elements.push(createFreehand(wavePoints, false));

  // "Beyond boxes": the data shapes (specs 46, 52) at their factory
  // defaults so they animate in exactly as a palette drop would.
  elements.push({
    ...createText(cx + RIGHT_HEAD.x, cy + RIGHT_HEAD.y),
    width: RIGHT_HEAD.w,
    height: RIGHT_HEAD.h,
    label: 'Beyond boxes',
    textSize: 'sm',
    textBold: true,
  });
  elements.push({ ...createShape('progress-bar', cx + BAR.x, cy + BAR.y), progress: 72 });
  elements.push({ ...createShape('progress-ring', cx + RING.x, cy + RING.y), progress: 72 });
  elements.push({
    ...createShape('rating', cx + STARS.x, cy + STARS.y),
    width: STARS.w,
    height: STARS.h,
  });

  for (const m of MARKERS) {
    elements.push({ ...createAnnotation(cx + m.x, cy + m.y), note: m.note });
  }

  return elements;
}
