import {
  isBoxed,
  type Anchor,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type ElementId,
  type FreehandElement,
  type ImageElement,
  type ShapeElement,
  type ShapeKind,
  type StickyElement,
  type TableElement,
  type TextElement,
} from './index';

// --- Factories -------------------------------------------------------------

// Default size per shape kind. Uniform 120 for square / circle / diamond,
// natural aspect ratios for the flowchart-vocabulary shapes (cylinder
// taller than wide, parallelogram + hexagon + document wider than tall).
const SHAPE_DEFAULT_SIZE: Record<ShapeKind, { width: number; height: number }> = {
  square: { width: 120, height: 120 },
  circle: { width: 120, height: 120 },
  diamond: { width: 120, height: 120 },
  cylinder: { width: 100, height: 140 },
  parallelogram: { width: 160, height: 100 },
  hexagon: { width: 140, height: 120 },
  document: { width: 140, height: 110 },
  // Stadium / pill — the conventional flowchart "Start / End" terminator
  // shape. Wider than tall by default; the CSS `border-radius: 9999px`
  // render path means the ends stay perfectly semicircular at any
  // aspect ratio the user resizes to.
  stadium: { width: 160, height: 64 },
  // Actor (UML stickman): line-art figure with its label below. Taller
  // than wide and aspect-locked on create so the figure never distorts.
  // Default size hugs the figure tightly — earlier 90×150 left a 38-
  // unit band below the legs which read as wasted padding under bare
  // (unlabelled) stickmen. 90×130 keeps room for a short label
  // (y 112..130) without dominating the box.
  actor: { width: 90, height: 130 },
  // Cloud: a container shape (networking / architecture). Stretches to
  // fit its label like the other flowchart shapes.
  cloud: { width: 180, height: 140 },
  // UI device frames. Sized to evoke each device's natural aspect
  // ratio at a glance: browser + monitor land on a 4:3-ish landscape
  // (with the monitor a touch taller to leave room for its stand);
  // laptop is wider with a flatter total profile (screen + keyboard
  // base stacked); phone + tablet are portrait at typical phone /
  // tablet ratios.
  browser: { width: 240, height: 160 },
  monitor: { width: 220, height: 170 },
  laptop: { width: 240, height: 150 },
  phone: { width: 90, height: 170 },
  tablet: { width: 140, height: 180 },
  // Curated glyph. Square + aspect-locked on create (set in
  // createShape) so the line art never distorts; the label sits below.
  icon: { width: 88, height: 88 },
};

// New boxed elements default to Medium text size per spec 09 ("Text size").
export function createShape(kind: ShapeKind, x: number, y: number): ShapeElement {
  const { width, height } = SHAPE_DEFAULT_SIZE[kind];
  const base: ShapeElement = {
    id: crypto.randomUUID(),
    type: 'shape',
    shape: kind,
    x,
    y,
    width,
    height,
    textSize: 'md',
  };
  // The actor is a figure with its label beneath the legs, not text
  // inside a box. Lock the aspect ratio so resizing never warps the
  // stickman, and default the label to the bottom band.
  if (kind === 'actor') {
    return { ...base, aspectLocked: true, textAlignY: 'bottom' };
  }
  // Icons: aspect-locked so the glyph never warps, label sits beneath
  // the glyph (the icon fills the box, text below reads as a caption).
  if (kind === 'icon') {
    return { ...base, aspectLocked: true, textAlignY: 'bottom' };
  }
  return base;
}

export function createText(x: number, y: number): TextElement {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    x,
    y,
    width: 220,
    height: 64,
    label: 'Text',
    textSize: 'md',
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

// Ramer-Douglas-Peucker polyline simplification. Drops samples that
// sit close to the straight line between their neighbours; the
// `tolerance` is the max allowed perpendicular distance in canvas
// pixels. Returns a new array (input untouched). Pure: no
// randomness, no time-dependence.
//
// Caller passes the raw pointer samples + a tolerance scaled to
// viewport zoom so the visible jitter is what gets smoothed, not
// absolute canvas pixels. A short polyline (< 3 points) is returned
// as-is, the algorithm is a no-op there.
export function simplifyPolyline(
  points: { x: number; y: number }[],
  tolerance: number,
): { x: number; y: number }[] {
  if (points.length < 3) return points.slice();
  const tol2 = tolerance * tolerance;
  // Iterative RDP via an explicit stack so deep recursion can't blow
  // the call stack on a several-thousand-sample gesture.
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    if (end <= start + 1) continue;
    let maxDist2 = 0;
    let maxIdx = start;
    const a = points[start]!;
    const b = points[end]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lineLen2 = dx * dx + dy * dy;
    for (let i = start + 1; i < end; i++) {
      const p = points[i]!;
      let d2: number;
      if (lineLen2 === 0) {
        // start == end (degenerate). Distance is just to the point.
        const ex = p.x - a.x;
        const ey = p.y - a.y;
        d2 = ex * ex + ey * ey;
      } else {
        // Perpendicular distance from p to line a..b, squared.
        const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lineLen2;
        const projX = a.x + t * dx;
        const projY = a.y + t * dy;
        const ex = p.x - projX;
        const ey = p.y - projY;
        d2 = ex * ex + ey * ey;
      }
      if (d2 > maxDist2) {
        maxDist2 = d2;
        maxIdx = i;
      }
    }
    if (maxDist2 > tol2) {
      keep[maxIdx] = true;
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]!);
  return out;
}

// Catmull-Rom to cubic-Bezier SVG path. Turns a sequence of points
// into a smooth curve passing through every one. The output is an
// SVG `d` attribute string (M, then cubic C segments). `closed`
// adds the closing tangent + the `Z` terminator so a filled
// freehand reads as a continuous outline.
//
// Algorithm: for each segment p1..p2, compute control points from
// the neighbouring p0 and p3 using Catmull-Rom tangents (alpha=0.5,
// uniform tension). Endpoints reuse themselves as the missing
// neighbour. Pure: no allocations beyond the output strings, no
// time-dependence.
export function catmullRomToBezierPath(
  points: { x: number; y: number }[],
  closed: boolean,
): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0]!;
    return `M ${p.x} ${p.y}`;
  }
  const n = points.length;
  const get = (i: number): { x: number; y: number } => {
    if (closed) return points[((i % n) + n) % n]!;
    if (i < 0) return points[0]!;
    if (i >= n) return points[n - 1]!;
    return points[i]!;
  };
  const out: string[] = [];
  out.push(`M ${points[0]!.x} ${points[0]!.y}`);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    // Catmull-Rom -> Bezier conversion (uniform / alpha = 0.5 ish).
    // The 1/6 factor produces a smooth curve passing through p1
    // and p2 with control points pulled from p0 and p3.
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    out.push(`C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`);
  }
  if (closed) out.push('Z');
  return out.join(' ');
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

// Duplicate every element whose id is in `ids`:
// - Boxed elements get fresh ids and a position offset of (dx, dy).
// - Arrows whose both endpoints are pinned to ids inside the set get fresh
//   ids with endpoints remapped to the duplicates.
// - Grouping is PRESERVED, not invented: each distinct source `groupId`
//   is remapped to a fresh one, so a duplicated group stays a (distinct)
//   group while loose elements stay loose. A new group left with only one
//   member (e.g. a marquee that caught part of a group) is dropped, so we
//   never mint a lone group. (Previously every multi-element duplication
//   was forced into one shared group, which surprised users pasting a
//   loose marquee selection — see useClipboard.)
//
// Returns the new elements plus a map of old → new ids so callers can wire
// extra arrows (e.g. a connector from the original to the duplicate).
export function duplicateGroupedElements(
  elements: Element[],
  ids: Set<ElementId>,
  dx: number,
  dy: number,
): { newElements: Element[]; idMap: Map<ElementId, ElementId> } {
  const idMap = new Map<ElementId, ElementId>();
  const newBoxed: BoxedElement[] = [];

  for (const el of elements) {
    if (!ids.has(el.id) || !isBoxed(el)) continue;
    const newId = crypto.randomUUID();
    idMap.set(el.id, newId);
    newBoxed.push({ ...el, id: newId, x: el.x + dx, y: el.y + dy });
  }

  // Remap each distinct source groupId to a fresh one so copied groups
  // stay grouped (and distinct from the originals) without welding loose
  // elements together. newBoxed already carries the source groupId via
  // the spread above.
  const groupIdMap = new Map<string, string>();
  const remapped: BoxedElement[] = newBoxed.map((el) => {
    if (el.groupId === undefined) return el;
    let next = groupIdMap.get(el.groupId);
    if (next === undefined) {
      next = crypto.randomUUID();
      groupIdMap.set(el.groupId, next);
    }
    return { ...el, groupId: next };
  });
  // Drop any new group that ended up with a single member — a group of
  // one is degenerate (happens when only part of a source group was in
  // the duplicated set).
  const groupCounts = new Map<string, number>();
  for (const el of remapped) {
    if (el.groupId !== undefined) {
      groupCounts.set(el.groupId, (groupCounts.get(el.groupId) ?? 0) + 1);
    }
  }
  const finalBoxed: Element[] = remapped.map((el) => {
    if (el.groupId !== undefined && (groupCounts.get(el.groupId) ?? 0) < 2) {
      const lone = { ...el };
      delete lone.groupId;
      return lone;
    }
    return el;
  });

  const newArrows: ArrowElement[] = [];
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    if (el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
    const newFromId = idMap.get(el.from.elementId);
    const newToId = idMap.get(el.to.elementId);
    if (!newFromId || !newToId) continue;
    newArrows.push({
      id: crypto.randomUUID(),
      type: 'arrow',
      from: { kind: 'pinned', elementId: newFromId, anchor: el.from.anchor },
      to: { kind: 'pinned', elementId: newToId, anchor: el.to.anchor },
      ...(el.locked === true ? { locked: true } : {}),
    });
  }

  return { newElements: [...finalBoxed, ...newArrows], idMap };
}
