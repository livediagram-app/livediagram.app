// Factories for every element type EXCEPT shapes: text, tables, stickies,
// annotations, link cards, videos, images, freehand strokes and arrows, plus
// scaleElements. The shape kind table and createShape moved to
// './shape-factory' when this file reached 719 lines.
//
// `isBoxed` is imported from './index' rather than a leaf: it is only called
// inside function bodies, after the index cycle has settled, so it does not
// hit the module-init TDZ hazard that pins './shape-factory' to the leaves.
import {
  isBoxed,
  type Anchor,
  type AnnotationElement,
  type LinkCardElement,
  type EmbedProvider,
  type VideoElement,
  type ArrowElement,
  type Element,
  type ElementId,
  type FreehandElement,
  type ImageElement,
  type StickyElement,
  type TableElement,
  type TextElement,
} from './index';

// The shape kind table + createShape live in './shape-factory'. Re-exported
// here so every existing `from './factories'` import (graph-authoring) and the
// package barrel resolve exactly as before.
export { SHAPE_DEFAULT_SIZE, createShape } from './shape-factory';

export function createText(x: number, y: number): TextElement {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    x,
    y,
    width: 220,
    height: 64,
    label: 'Text',
    // Standalone text renders at the fixed px for its size (sm = 14px), and a
    // text element is plain text on the canvas, not a label inside a box, so
    // 'md' (22px) read oversized — especially on a phone. Default to 'sm';
    // the user can bump it from the edit toolbar.
    textSize: 'sm',
  };
}

// A fresh 3x3 table with an empty header row. Sized so the default
// cells are comfortably clickable; the grid divides the box evenly.
export function createTable(x: number, y: number): TableElement {
  const rows = 3;
  const cols = 3;
  return {
    id: crypto.randomUUID(),
    type: 'table',
    x,
    y,
    width: 360,
    height: 150,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
    headerRow: true,
    textSize: 'md',
  };
}

export function createSticky(x: number, y: number): StickyElement {
  return {
    id: crypto.randomUUID(),
    type: 'sticky',
    x,
    y,
    width: 200,
    height: 200,
    textSize: 'md',
  };
}

// Fixed marker size for an annotation (see specs/38). It never resizes, so
// this is its size for life; `inheritedSizeFor` keeps it at this regardless
// of the current selection.
const ANNOTATION_SIZE = 44;

// A note marker dropped at (x, y). The note text starts empty — the user
// clicks the marker to add it. Aspect-locked by default so resizing keeps
// the marker round (spec/38).
export function createAnnotation(x: number, y: number): AnnotationElement {
  return {
    id: crypto.randomUUID(),
    type: 'annotation',
    x,
    y,
    width: ANNOTATION_SIZE,
    height: ANNOTATION_SIZE,
    aspectLocked: true,
  };
}

// A link-card / bookmark (spec/40) at (x, y). No link yet — the user sets
// the URL via the link picker, and the editor fills `meta` from the unfurl
// endpoint. Default size suits a favicon + title row above an optional image.
export function createLinkCard(x: number, y: number): LinkCardElement {
  return {
    id: crypto.randomUUID(),
    type: 'link-card',
    x,
    y,
    width: 280,
    height: 120,
  };
}

// A YouTube video (spec/114) at (x, y). No link yet — the user sets the URL
// via the same link picker a link card uses, and the id is parsed from it on
// render. 480x270 is a true 16:9, and `aspectLocked` keeps it that way: a
// stretched video frame is never what anyone wants.
export function createVideo(x: number, y: number, provider?: EmbedProvider): VideoElement {
  return {
    id: crypto.randomUUID(),
    type: 'video',
    x,
    y,
    width: 480,
    height: 270,
    aspectLocked: true,
    // Which tile it came from (spec/121), so the empty state can name the
    // service rather than listing all five.
    ...(provider ? { embedProvider: provider } : {}),
  };
}

// Scale a set of elements uniformly about (ox, oy) — used to drag-to-draw a
// component to size (spec/09). Boxed elements scale position + size; arrows
// scale only their FREE endpoints (pinned ones track their elements). Font
// sizes are unchanged (matches group resize).
export function scaleElements(elements: Element[], ox: number, oy: number, s: number): Element[] {
  return elements.map((el) => {
    if (isBoxed(el)) {
      return {
        ...el,
        x: ox + (el.x - ox) * s,
        y: oy + (el.y - oy) * s,
        width: el.width * s,
        height: el.height * s,
      };
    }
    const from =
      el.from.kind === 'free'
        ? { ...el.from, x: ox + (el.from.x - ox) * s, y: oy + (el.from.y - oy) * s }
        : el.from;
    const to =
      el.to.kind === 'free'
        ? { ...el.to, x: ox + (el.to.x - ox) * s, y: oy + (el.to.y - oy) * s }
        : el.to;
    return { ...el, from, to };
  });
}

// Spawns an image element in the empty-state (placeholder) shape. The
// imageId stays null until the user picks an image from the picker;
// the renderer shows the upload affordance in the meantime.
export function createImage(x: number, y: number): ImageElement {
  return {
    id: crypto.randomUUID(),
    type: 'image',
    x,
    y,
    width: 200,
    height: 150,
    imageId: null,
    // Aspect-lock default: once a real image lands, the lock keeps
    // its width:height ratio. Holding Shift while resizing the
    // corner handle breaks it via the existing aspect-lock toggle.
    aspectLocked: true,
  };
}

// Mints a freehand element from raw canvas-coord points. Caller is
// responsible for the simplification + smoothing decision (see
// `simplifyPolyline` and `catmullRomToBezierPath` below); this just
// computes the bounding box and normalises the points into [0..1]
// inside it so the saved element resizes proportionally without the
// renderer needing the original canvas coords back. A degenerate
// (single-point) gesture returns a 1x1 box with one normalised point
// at the origin, which the caller can detect and reject.
export function createFreehand(
  rawPoints: { x: number; y: number }[],
  closed: boolean,
): FreehandElement {
  if (rawPoints.length === 0) {
    return {
      id: crypto.randomUUID(),
      type: 'freehand',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      points: [],
      closed,
    };
  }
  let minX = rawPoints[0]!.x;
  let maxX = rawPoints[0]!.x;
  let minY = rawPoints[0]!.y;
  let maxY = rawPoints[0]!.y;
  for (const p of rawPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  // Pad the box by a single pixel on each side so a perfectly
  // straight line (zero width OR zero height) still has a non-zero
  // dimension to normalise against. Without this, dividing by 0
  // produces NaN points and the renderer breaks.
  const PAD = 1;
  const width = Math.max(1, maxX - minX + PAD * 2);
  const height = Math.max(1, maxY - minY + PAD * 2);
  const ox = minX - PAD;
  const oy = minY - PAD;
  const points = rawPoints.map((p) => ({
    nx: (p.x - ox) / width,
    ny: (p.y - oy) / height,
  }));
  return {
    id: crypto.randomUUID(),
    type: 'freehand',
    x: ox,
    y: oy,
    width,
    height,
    points,
    closed,
  };
}

export function createArrow(fromX: number, fromY: number, toX: number, toY: number): ArrowElement {
  return {
    id: crypto.randomUUID(),
    type: 'arrow',
    from: { kind: 'free', x: fromX, y: fromY },
    to: { kind: 'free', x: toX, y: toY },
  };
}

export function createPinnedArrow(
  fromId: ElementId,
  fromAnchor: Anchor,
  toId: ElementId,
  toAnchor: Anchor,
): ArrowElement {
  return {
    id: crypto.randomUUID(),
    type: 'arrow',
    from: { kind: 'pinned', elementId: fromId, anchor: fromAnchor },
    to: { kind: 'pinned', elementId: toId, anchor: toAnchor },
  };
}
