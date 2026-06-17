import {
  isBoxed,
  type Anchor,
  type AnnotationElement,
  type LinkCardElement,
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
// Exported so the editor can offer "reset to default aspect ratio" — the
// width:height proportion here is each shape's canonical look.
export const SHAPE_DEFAULT_SIZE: Record<ShapeKind, { width: number; height: number }> = {
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
  triangle: { width: 130, height: 120 },
  trapezoid: { width: 160, height: 110 },
  star: { width: 130, height: 130 },
  // Speech bubble: wider than tall, with room for the tail beneath the body.
  'speech-bubble': { width: 180, height: 130 },
  // Frame / section: a large container drawn around content, so it starts
  // big. Transparent body (see shape-svg-overlay) with a top-left label.
  frame: { width: 360, height: 260 },
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
  // Smartwatch: a square-ish face with bands above + below, so portrait.
  smartwatch: { width: 110, height: 150 },
  // Curated glyph. Square + aspect-locked on create (set in createShape) so
  // the line art never distorts; the label sits below. Sized generously so a
  // two-line caption (e.g. "Durable Objects") clears the glyph rather than
  // crowding it.
  icon: { width: 120, height: 120 },
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
  // Frame: a container drawn around other elements. Its label sits in the
  // top-right (like a section title) rather than centred, and the body is
  // transparent (rendered fill-less in shape-svg-overlay) so content shows
  // through.
  if (kind === 'frame') {
    // Frames start with a "Frame" section title in the top-right, padded in
    // off the border so it doesn't touch the outline, so they read as a
    // labelled container the moment they're dropped.
    return { ...base, label: 'Frame', textAlignY: 'top', textAlignX: 'right', padding: 'lg' };
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

// Banner (spec/09): a decorative title block, built as a COMPOSITE group of
// existing primitives rather than a new element type — an accent-filled
// rounded bar with a bold title and a muted subtitle, all sharing one
// `groupId` so they move / lock / copy as a unit yet stay individually
// editable (and ungroupable). Laid out around the CENTRE (cx, cy) since it's
// dropped at the viewport centre. `accent` is the theme's accent colour (the
// caller maps theme -> colour, keeping this package theme-agnostic); the bar
// is filled with it and the text is white for contrast. Returned in paint
// order (bar first, so the text sits on top).
export const BANNER_WIDTH = 440;
export const BANNER_HEIGHT = 104;
export function createBanner(cx: number, cy: number, accent: string): BoxedElement[] {
  const groupId: ElementId = crypto.randomUUID();
  const left = cx - BANNER_WIDTH / 2;
  const top = cy - BANNER_HEIGHT / 2;
  const inset = 24;
  const titleHeight = 42;

  // Accent bar: a rounded square shape stretched wide, filled with the
  // accent and borderless so it reads as a solid band.
  const bar: ShapeElement = {
    ...createShape('square', left, top),
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    fillColor: accent,
    strokeColor: accent,
    strokeWidth: 'none',
    borderRadius: 'lg',
    groupId,
  };
  // Title: large, bold, centred, white on the accent.
  const title: TextElement = {
    ...createText(left + inset, top + 20),
    width: BANNER_WIDTH - inset * 2,
    height: titleHeight,
    label: 'Banner title',
    textSize: 'lg',
    textBold: true,
    textAlignX: 'center',
    textAlignY: 'middle',
    textColor: '#ffffff',
    groupId,
  };
  // Subtitle: smaller, centred, slightly muted white beneath the title.
  const subtitle: TextElement = {
    ...createText(left + inset, top + 20 + titleHeight - 4),
    width: BANNER_WIDTH - inset * 2,
    height: 26,
    label: 'Subtitle or description',
    textSize: 'sm',
    textAlignX: 'center',
    textAlignY: 'middle',
    textColor: '#ffffff',
    opacity: 0.85,
    groupId,
  };
  return [bar, title, subtitle];
}

// Avatar (spec/09): a circular image. Just an ImageElement that's square +
// aspect-locked with a 'full' corner radius (CSS clamps that to a circle).
// Built to back the Header component but also useful standalone. Centred on
// (cx, cy); imageId is null until the picker fills it.
export const AVATAR_SIZE = 96;
export function createAvatar(cx: number, cy: number): ImageElement {
  return {
    ...createImage(cx - AVATAR_SIZE / 2, cy - AVATAR_SIZE / 2),
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 'full',
    objectFit: 'cover',
    aspectLocked: true,
  };
}

// Hero (spec/09): a large image with a title + supporting line on a themed
// caption card, as a composite GROUP (image + card + title + body sharing one
// groupId). The card is the theme accent (the hero follows the tab theme),
// inset near the bottom rather than covering the whole image — so the image
// stays double-clickable to set / change it (the picker is no longer opened
// automatically). `accent` is supplied by the caller (theme -> colour mapping
// stays in the app). Returned in paint order: image, then card, then text.
export const HERO_WIDTH = 520;
export const HERO_HEIGHT = 300;
export function createHero(cx: number, cy: number, accent: string): BoxedElement[] {
  const groupId: ElementId = crypto.randomUUID();
  const left = cx - HERO_WIDTH / 2;
  const top = cy - HERO_HEIGHT / 2;
  const cardMargin = 22;
  const cardHeight = 96;
  const cardLeft = left + cardMargin;
  const cardWidth = HERO_WIDTH - cardMargin * 2;
  const cardTop = top + HERO_HEIGHT - cardMargin - cardHeight;
  const textInset = 20;
  const image: ImageElement = {
    ...createImage(left, top),
    width: HERO_WIDTH,
    height: HERO_HEIGHT,
    borderRadius: 'lg',
    objectFit: 'cover',
    groupId,
  };
  // Caption card: accent at high opacity so the white text reads regardless of
  // the photo behind it, but inset so the image is reachable above / around it.
  const card: ShapeElement = {
    ...createShape('square', cardLeft, cardTop),
    width: cardWidth,
    height: cardHeight,
    fillColor: accent,
    strokeColor: accent,
    strokeWidth: 'none',
    borderRadius: 'lg',
    opacity: 0.82,
    groupId,
  };
  const title: TextElement = {
    ...createText(cardLeft + textInset, cardTop + 16),
    width: cardWidth - textInset * 2,
    height: 34,
    label: 'Hero title',
    textSize: 'lg',
    textBold: true,
    textAlignX: 'center',
    textAlignY: 'middle',
    textColor: '#ffffff',
    groupId,
  };
  const body: TextElement = {
    ...createText(cardLeft + textInset, cardTop + 16 + 32),
    width: cardWidth - textInset * 2,
    height: 30,
    label: 'A short supporting line of text over the image.',
    textSize: 'sm',
    textAlignX: 'center',
    textAlignY: 'middle',
    textColor: '#ffffff',
    opacity: 0.92,
    groupId,
  };
  return [image, card, title, body];
}

// Header (spec/09): a website-style header bar as a composite GROUP — an
// accent bar with a circular avatar on the left, a brand/logo title beside
// it, and a row of nav links on the right, all sharing one groupId. Follows
// the tab theme via the accent bar + white text. Returned in paint order
// (bar first). Centred on (cx, cy).
export const HEADER_WIDTH = 640;
export const HEADER_HEIGHT = 84;
const HEADER_LINKS = ['Home', 'About', 'Contact'] as const;
export function createHeader(cx: number, cy: number, accent: string): BoxedElement[] {
  const groupId: ElementId = crypto.randomUUID();
  const left = cx - HEADER_WIDTH / 2;
  const top = cy - HEADER_HEIGHT / 2;
  const pad = 22;
  const avatarSize = 48;
  const bar: ShapeElement = {
    ...createShape('square', left, top),
    width: HEADER_WIDTH,
    height: HEADER_HEIGHT,
    fillColor: accent,
    strokeColor: accent,
    strokeWidth: 'none',
    borderRadius: 'md',
    groupId,
  };
  const avatar: ImageElement = {
    ...createImage(left + pad, top + (HEADER_HEIGHT - avatarSize) / 2),
    width: avatarSize,
    height: avatarSize,
    borderRadius: 'full',
    objectFit: 'cover',
    aspectLocked: true,
    groupId,
  };
  const titleHeight = 30;
  const title: TextElement = {
    ...createText(left + pad + avatarSize + 14, top + (HEADER_HEIGHT - titleHeight) / 2),
    width: 200,
    height: titleHeight,
    label: 'Brand',
    textSize: 'md',
    textBold: true,
    textAlignX: 'left',
    textAlignY: 'middle',
    textColor: '#ffffff',
    groupId,
  };
  const linkW = 92;
  const linkH = 28;
  const gap = 4;
  const linkY = top + (HEADER_HEIGHT - linkH) / 2;
  const rowWidth = HEADER_LINKS.length * linkW + (HEADER_LINKS.length - 1) * gap;
  const rowStart = left + HEADER_WIDTH - pad - rowWidth;
  const links: TextElement[] = HEADER_LINKS.map((label, i) => ({
    ...createText(rowStart + i * (linkW + gap), linkY),
    width: linkW,
    height: linkH,
    label,
    textSize: 'sm',
    textAlignX: 'center',
    textAlignY: 'middle',
    textColor: '#ffffff',
    opacity: 0.9,
    groupId,
  }));
  return [bar, avatar, title, ...links];
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

  const existingIds = new Set(elements.map((e) => e.id));
  // Re-point one endpoint of a duplicated arrow: a FREE end translates by
  // (dx, dy) so a free-floating arrow copies in place like any boxed
  // element; a PINNED end follows its duplicate when the target was
  // copied, otherwise keeps the original pin (still a real element, so no
  // orphan). A pin to an element that's gone entirely (e.g. a cross-tab
  // paste where the target wasn't carried over) returns null and the
  // whole arrow is skipped rather than left dangling.
  const remapEndpoint = (end: ArrowElement['from']): ArrowElement['from'] | null => {
    if (end.kind === 'free') return { kind: 'free', x: end.x + dx, y: end.y + dy };
    const dup = idMap.get(end.elementId);
    if (dup) return { kind: 'pinned', elementId: dup, anchor: end.anchor };
    return existingIds.has(end.elementId) ? end : null;
  };

  const newArrows: ArrowElement[] = [];
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    // An arrow copies when it's explicitly in the duplicated set, OR when
    // both endpoints pin to elements that were duplicated — the latter is
    // the group / quick-connect case where an internal connector should
    // ride along with its group even if the marquee didn't catch the
    // arrow itself.
    const bothEndsDuplicated =
      el.from.kind === 'pinned' &&
      el.to.kind === 'pinned' &&
      idMap.has(el.from.elementId) &&
      idMap.has(el.to.elementId);
    if (!ids.has(el.id) && !bothEndsDuplicated) continue;
    const from = remapEndpoint(el.from);
    const to = remapEndpoint(el.to);
    if (!from || !to) continue;
    // Spread the source so styling (stroke, ends, dash, arrowhead, curve,
    // label) survives the copy; only the id + endpoints are replaced.
    newArrows.push({ ...el, id: crypto.randomUUID(), from, to });
  }

  return { newElements: [...finalBoxed, ...newArrows], idMap };
}
