// Factories for every element type EXCEPT shapes: text, tables, stickies, annotations, link cards, videos,
// images, freehand strokes and arrows, plus scaleElements. Each product keeps its own shape kind table and
// createShape ('./shape-factory') and binds these to its own element types: every factory returns the exact
// literal it builds, so a product's door can type it as that product's element without a cast.
import { packFreehandPoints } from './freehand-points';
import { isBoxed } from './element';

type Box = { id: string; x: number; y: number; width: number; height: number };

export function createText(
  x: number,
  y: number,
): Box & { type: 'text'; label: string; textSize: 'sm' } {
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
    // 'md' (22px) read oversized, especially on a phone. Default to 'sm';
    // the user can bump it from the edit toolbar.
    textSize: 'sm',
  };
}

// A fresh 3x3 table with an empty header row. Sized so the default
// cells are comfortably clickable; the grid divides the box evenly.
export function createTable(
  x: number,
  y: number,
): Box & { type: 'table'; cells: string[][]; headerRow: boolean; textSize: 'md' } {
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

export function createSticky(x: number, y: number): Box & { type: 'sticky'; textSize: 'md' } {
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

// Fixed marker size for an annotation (see docs/specs/009-elements/annotations.md). It never resizes, so
// this is its size for life; `inheritedSizeFor` keeps it at this regardless
// of the current selection.
const ANNOTATION_SIZE = 44;

// A note marker dropped at (x, y). The note text starts empty: the user
// clicks the marker to add it. Aspect-locked by default so resizing keeps
// the marker round (docs/specs/009-elements/annotations.md).
export function createAnnotation(
  x: number,
  y: number,
): Box & { type: 'annotation'; aspectLocked: true } {
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

// A link-card / bookmark (docs/specs/009-elements/link-cards.md) at (x, y). No link yet: the user sets
// the URL via the link picker; `meta` holds a cached preview when there is one. Default size suits a
// favicon + title row above an optional image.
export function createLinkCard(x: number, y: number): Box & { type: 'link-card' } {
  return {
    id: crypto.randomUUID(),
    type: 'link-card',
    x,
    y,
    width: 280,
    height: 120,
  };
}

// A YouTube video (docs/specs/009-elements/youtube-video.md) at (x, y). No link yet: the user sets the URL
// via the same link picker a link card uses, and the id is parsed from it on
// render. 480x270 is a true 16:9, and `aspectLocked` keeps it that way: a
// stretched video frame is never what anyone wants.
export function createVideo<P extends string>(
  x: number,
  y: number,
  provider?: P,
): Box & { type: 'video'; aspectLocked: true; embedProvider?: P } {
  return {
    id: crypto.randomUUID(),
    type: 'video',
    x,
    y,
    width: 480,
    height: 270,
    aspectLocked: true,
    // Which tile it came from (docs/specs/009-elements/embed-providers.md), so the empty state can name the
    // service rather than listing all five.
    ...(provider ? { embedProvider: provider } : {}),
  };
}

// The least scaleElements reads: a box, or an arrow whose free ends move.
type ScaleEnd = { kind: string; x?: number; y?: number };
type ScaledArrow = { type: 'arrow'; from: ScaleEnd; to: ScaleEnd };

function scaleEnd(end: ScaleEnd, ox: number, oy: number, s: number): ScaleEnd {
  return end.kind === 'free'
    ? { ...end, x: ox + (end.x! - ox) * s, y: oy + (end.y! - oy) * s }
    : end;
}

// Scale a set of elements uniformly about (ox, oy), used to drag-to-draw a
// component to size (docs/specs/008-canvas/canvas-and-palette.md). Boxed elements scale position + size; arrows
// scale only their FREE endpoints (pinned ones track their elements). Font
// sizes are unchanged (matches group resize).
export function scaleElements<E extends { type: string }>(
  elements: E[],
  ox: number,
  oy: number,
  s: number,
): E[] {
  return elements.map((el) => {
    if (isBoxed(el)) {
      const box = el as unknown as Box;
      return {
        ...el,
        x: ox + (box.x - ox) * s,
        y: oy + (box.y - oy) * s,
        width: box.width * s,
        height: box.height * s,
      };
    }
    const arrow = el as unknown as ScaledArrow;
    return {
      ...el,
      from: scaleEnd(arrow.from, ox, oy, s),
      to: scaleEnd(arrow.to, ox, oy, s),
    };
  });
}

// Spawns an image element in the empty-state (placeholder) shape. The
// imageId stays null until the user picks an image from the picker;
// the renderer shows the upload affordance in the meantime.
export function createImage(
  x: number,
  y: number,
): Box & { type: 'image'; imageId: null; aspectLocked: true } {
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

// Mints a freehand element from raw canvas-coord points (freehandGeometry). The
// caller decides the simplification and smoothing (see `simplifyPolyline` and
// `catmullRomToBezierPath`). A degenerate (single-point) gesture returns a box
// with one normalised point, which the caller can detect and reject.
// A pen's pressures (one per point, 0 to 1) are packed with the points.
export function createFreehand(
  rawPoints: readonly { x: number; y: number }[],
  closed: boolean,
  pressures?: readonly number[],
): Box & { type: 'freehand'; packedPoints: string; closed: boolean } {
  return {
    id: crypto.randomUUID(),
    type: 'freehand',
    ...packFreehandPoints(rawPoints, pressures),
    closed,
  };
}

type FreeEnd = { kind: 'free'; x: number; y: number };

export function createArrow(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { id: string; type: 'arrow'; from: FreeEnd; to: FreeEnd } {
  return {
    id: crypto.randomUUID(),
    type: 'arrow',
    from: { kind: 'free', x: fromX, y: fromY },
    to: { kind: 'free', x: toX, y: toY },
  };
}

type PinnedEnd<A> = { kind: 'pinned'; elementId: string; anchor: A };

export function createPinnedArrow<A>(
  fromId: string,
  fromAnchor: A,
  toId: string,
  toAnchor: A,
): { id: string; type: 'arrow'; from: PinnedEnd<A>; to: PinnedEnd<A> } {
  return {
    id: crypto.randomUUID(),
    type: 'arrow',
    from: { kind: 'pinned', elementId: fromId, anchor: fromAnchor },
    to: { kind: 'pinned', elementId: toId, anchor: toAnchor },
  };
}
