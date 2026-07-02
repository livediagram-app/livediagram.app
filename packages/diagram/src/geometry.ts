import {
  arrowLabelAnchor,
  arrowStyleOf,
  isBoxed,
  type Anchor,
  type BoxedElement,
  type Element,
  type ElementId,
  type Endpoint,
} from './index';

// --- Geometry helpers ------------------------------------------------------

export type Point = { x: number; y: number };

// Rotate `p` clockwise about `center` by `deg` degrees, matching the
// CSS `transform: rotate(deg)` the canvas applies to a rotated element
// (positive = clockwise in the y-down canvas space). Pure helper shared
// by anchorPosition + bestAnchorTowards.
function rotatePoint(p: Point, center: Point, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

// The anchor point on the element's UNROTATED axis-aligned box.
function localAnchorPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  anchor: Anchor,
): Point {
  switch (anchor) {
    case 'nw':
      return { x, y };
    case 'n':
      return { x: x + width / 2, y };
    case 'ne':
      return { x: x + width, y };
    case 'e':
      return { x: x + width, y: y + height / 2 };
    case 'se':
      return { x: x + width, y: y + height };
    case 's':
      return { x: x + width / 2, y: y + height };
    case 'sw':
      return { x, y: y + height };
    case 'w':
      return { x, y: y + height / 2 };
  }
}

// Outline polygons for the SVG-rendered shapes whose drawn edge differs
// from their bounding box, in the shared 0..100 viewBox the overlay paints
// in (apps/live/components/shape-svg-overlay.tsx). Kept in lock-step with
// that file: an anchor projected onto these vertices lands on the line the
// user actually sees. Convex only — the ray-exit test below assumes one
// boundary crossing, so non-convex shapes (star, cloud, speech-bubble) are
// deliberately absent and fall back to the bounding box.
const SHAPE_OUTLINES: Partial<Record<string, readonly [number, number][]>> = {
  diamond: [
    [50, 0],
    [100, 50],
    [50, 100],
    [0, 50],
  ],
  parallelogram: [
    [20, 0],
    [100, 0],
    [80, 100],
    [0, 100],
  ],
  hexagon: [
    [25, 0],
    [75, 0],
    [100, 50],
    [75, 100],
    [25, 100],
    [0, 50],
  ],
  triangle: [
    [50, 2],
    [98, 98],
    [2, 98],
  ],
  trapezoid: [
    [22, 4],
    [78, 4],
    [98, 96],
    [2, 96],
  ],
};

// Project a bounding-box anchor onto the shape's actual drawn outline, so a
// connector meets a diamond's slanted edge or a circle's curve instead of
// floating in the empty bounding-box corner. Returns the point where the ray
// from the shape centre through the bbox anchor exits the shape, or null when
// the shape's outline IS its box (square, devices, text/table/sticky/image)
// so the caller keeps the plain anchor. Works in the element's local
// (unrotated) px space; the caller rotates the result out to world space.
function projectAnchorToShape(
  shape: string,
  x: number,
  y: number,
  width: number,
  height: number,
  p: Point,
): Point | null {
  if (width <= 0 || height <= 0) return null;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const dx = p.x - cx;
  const dy = p.y - cy;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;

  // Circle renders as an ellipse filling the box; intersect the centre->anchor
  // ray with that ellipse directly (cheaper + exact vs polygonising it).
  if (shape === 'circle') {
    const hx = width / 2;
    const hy = height / 2;
    const t = 1 / Math.sqrt((dx / hx) ** 2 + (dy / hy) ** 2);
    return { x: cx + dx * t, y: cy + dy * t };
  }

  const outline = SHAPE_OUTLINES[shape];
  if (!outline) return null;

  // Vertices mapped from the 0..100 viewBox into local px.
  const verts = outline.map(([vx, vy]) => ({
    x: x + (vx / 100) * width,
    y: y + (vy / 100) * height,
  }));
  // Smallest positive t where the ray centre + t*(dx,dy) crosses an edge.
  let bestT = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % verts.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const det = ex * dy - dx * ey;
    if (Math.abs(det) < 1e-9) continue; // ray parallel to this edge
    const rx = a.x - cx;
    const ry = a.y - cy;
    const t = (ex * ry - rx * ey) / det;
    const s = (dx * ry - rx * dy) / det;
    if (t > 1e-6 && s >= -1e-6 && s <= 1 + 1e-6 && t < bestT) bestT = t;
  }
  if (!Number.isFinite(bestT)) return null;
  return { x: cx + dx * bestT, y: cy + dy * bestT };
}

// Works on any boxed element since they share x/y/width/height. When the
// element carries a `rotation`, the anchor is rotated about the
// element's centre so a pinned arrow lands on the visually-rotated edge,
// not the pre-rotation position. Every pinned endpoint (rendering) and
// snapToAnchor (pinning) resolve through here, so they stay consistent.
//
// For non-rectangular shapes the anchor is first projected onto the shape's
// real outline (so a connector touches a diamond's edge, not the empty bbox
// corner) before any rotation is applied.
export function anchorPosition(element: BoxedElement, anchor: Anchor): Point {
  const { x, y, width, height } = element;
  let local = localAnchorPosition(x, y, width, height, anchor);
  if (element.type === 'shape') {
    const projected = projectAnchorToShape(element.shape, x, y, width, height, local);
    if (projected) local = projected;
  }
  const rotation = element.rotation ?? 0;
  if (!rotation) return local;
  return rotatePoint(local, { x: x + width / 2, y: y + height / 2 }, rotation);
}

// How decisively the off-axis direction must win before an arrow that is
// already bound to a face abandons it. Without this dead-band a connector
// flips between (say) the east and south face on every sub-pixel wobble
// when the target sits near the box's corner diagonal; the margin holds the
// choice steady while dragging and only commits to the new face once the
// target is clearly past the corner.
const ANCHOR_SWITCH_MARGIN = 0.2;

type Cardinal = 'n' | 'e' | 's' | 'w';
const CARDINALS: readonly Cardinal[] = ['n', 'e', 's', 'w'];

function isCardinal(anchor: Anchor): anchor is Cardinal {
  return anchor === 'n' || anchor === 'e' || anchor === 's' || anchor === 'w';
}

function centreOf(el: BoxedElement): Point {
  return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
}

// For a centre->`towards` direction, the parametric distance `t` at which
// the ray leaves the box through each cardinal face (smaller = the ray
// reaches that face sooner, so that's the face it actually exits through).
// A face the ray points away from is unreachable (`Infinity`). This slab /
// ray-box test underpins both face selection and ranking and is
// aspect-ratio aware: a short, wide box exits top/bottom for everything but
// near-horizontal targets, a tall box through its sides, where the earlier
// "nearest edge-midpoint to the far centre" metric picked whichever
// midpoint sat closest in raw distance even when the connecting line never
// crossed that face. Rotation is handled by bringing the direction into the
// element's unrotated frame first; anchorPosition rotates the chosen face
// back out to world space when the endpoint is resolved.
function faceExitTimes(element: BoxedElement, towards: Point): Record<Cardinal, number> {
  const c = centreOf(element);
  let dx = towards.x - c.x;
  let dy = towards.y - c.y;
  const rotation = element.rotation ?? 0;
  if (rotation) {
    const local = rotatePoint({ x: dx, y: dy }, { x: 0, y: 0 }, -rotation);
    dx = local.x;
    dy = local.y;
  }
  // `|| 1` guards a degenerate zero dimension; real elements clamp to MIN_SIZE.
  const halfWidth = element.width / 2 || 1;
  const halfHeight = element.height / 2 || 1;
  return {
    e: dx > 0 ? halfWidth / dx : Infinity,
    w: dx < 0 ? halfWidth / -dx : Infinity,
    s: dy > 0 ? halfHeight / dy : Infinity,
    n: dy < 0 ? halfHeight / -dy : Infinity,
  };
}

// The cardinal faces ranked best-first for a centre->`towards` direction
// (`ranked[0]` is the face the connecting line exits through, i.e. what
// bestAnchorTowards picks), plus a `commitment` ratio: how decisively the
// best face beats the runner-up (>= 1; `Infinity` when the box is faced
// head-on). Distribution uses the ordering to fall back to the next-best
// FREE face when several arrows land on one element, and the commitment to
// decide which arrow keeps a contested face (the most committed one wins it,
// the rest step aside).
export function rankAnchorsTowards(
  element: BoxedElement,
  towards: Point,
): { ranked: Cardinal[]; commitment: number; times: Record<Cardinal, number> } {
  const times = faceExitTimes(element, towards);
  // Stable base order so ties (a square faced at exactly 45deg) resolve
  // deterministically instead of depending on the sort implementation.
  const ranked = [...CARDINALS].sort((a, b) => times[a] - times[b]);
  const t0 = times[ranked[0]!];
  const t1 = times[ranked[1]!];
  const commitment = t0 === Infinity ? 0 : t1 === Infinity ? Infinity : t1 / t0;
  return { ranked, commitment, times };
}

// Where one endpoint should AIM when re-choosing its face: the closest
// point of the other box to this box's centre, not the other box's
// centre. Aiming at the centre picked visually wrong, inconsistent
// faces for elements that are mostly side-by-side but slightly offset —
// the ray toward a higher box's centre exits through the TOP face even
// though the boxes read as a row — so connectors attached to odd faces
// and siblings in one layout got different face pairs. Clamping the aim
// to the other box's nearest point makes any pair whose vertical spans
// overlap choose the opposing e/w faces (and n/s for overlapping
// horizontal spans): rows read as rows, columns as columns, and
// template layouts keep consistent connections. Truly diagonal pairs
// clamp to a corner, which preserves the ray behaviour they had. Falls
// back to the other centre when the boxes overlap (the clamp would
// return this centre itself — a degenerate ray).
export function anchorAimPoint(other: BoxedElement, fromCentre: Point): Point {
  const x = Math.min(Math.max(fromCentre.x, other.x), other.x + other.width);
  const y = Math.min(Math.max(fromCentre.y, other.y), other.y + other.height);
  if (x === fromCentre.x && y === fromCentre.y) return centreOf(other);
  return { x, y };
}

// Re-pin arrows whose either endpoint is anchored to a moved box, pointing
// each end at the face the connector now leaves through. Pure: takes the
// already-translated element list and the set of ids that just moved,
// returns the same list with each affected arrow's from/to anchors
// recomputed.
//
// Only re-anchors arrows where BOTH ends are pinned to a box. from/to pairs
// that mix free + pinned (one floating end) keep their anchors as-is: the
// free end already dictates the visual direction, and rebinding the pinned
// end against a floating point would jitter as the user drags.
//
// When several arrows attach to the SAME element they're distributed across
// its faces rather than stacked: the endpoint most committed to a contested
// face keeps it and the others fall to their next-best free face, so two
// arrows that both want a shape's north face end up on north + east. Faces
// held by pinned arrows we are NOT re-anchoring this pass (a mixed arrow's
// pinned end, or an arrow on a box that didn't move) are reserved so the
// re-pinned arrows route around them too.
export function rebindArrowAnchorsAfterMove(
  elements: Element[],
  movingIds: ReadonlySet<ElementId> | Map<ElementId, unknown>,
): Element[] {
  const includes = (id: ElementId) => movingIds.has(id);
  // Build the id index once so each affected arrow's from/to lookups
  // are O(1) instead of two `find` scans of the whole list per arrow
  // (this runs on every box-drag frame).
  const byId = buildElementIndex(elements);

  // Plan every endpoint we'll re-anchor, ranking each toward the OTHER
  // end's centre. Eligible arrows have both ends pinned to a box with at
  // least one box in the moving set.
  type EndPlan = {
    arrowId: ElementId;
    end: 'from' | 'to';
    elementId: ElementId;
    current: Anchor;
    ranked: Cardinal[];
    commitment: number;
    times: Record<Cardinal, number>;
  };
  const plans: EndPlan[] = [];
  const reassigning = new Set<ElementId>();
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    if (el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
    // Re-anchor only arrows that SPAN the moving boundary (exactly one end
    // pinned to a moved box). When BOTH ends moved together — a frame
    // section, group, or multi-select drag — the arrow translates rigidly
    // with its endpoints and its relative geometry is unchanged, so
    // re-choosing its faces would needlessly reflow it. When NEITHER moved
    // it's irrelevant. Both cases skip.
    if (includes(el.from.elementId) === includes(el.to.elementId)) continue;
    const fromEl = byId.get(el.from.elementId);
    const toEl = byId.get(el.to.elementId);
    if (!fromEl || !isBoxed(fromEl) || !toEl || !isBoxed(toEl)) continue;
    // A manual endpoint (the user dragged it onto that face) is excluded
    // from auto re-anchoring — it keeps its face; only the other end moves.
    // If BOTH ends are manual there's nothing to re-anchor.
    const fromManual = el.from.manual === true;
    const toManual = el.to.manual === true;
    if (fromManual && toManual) continue;
    reassigning.add(el.id);
    if (!fromManual) {
      plans.push({
        arrowId: el.id,
        end: 'from',
        elementId: fromEl.id,
        current: el.from.anchor,
        ...rankAnchorsTowards(fromEl, anchorAimPoint(toEl, centreOf(fromEl))),
      });
    }
    if (!toManual) {
      plans.push({
        arrowId: el.id,
        end: 'to',
        elementId: toEl.id,
        current: el.to.anchor,
        ...rankAnchorsTowards(toEl, anchorAimPoint(fromEl, centreOf(toEl))),
      });
    }
  }
  if (plans.length === 0) return elements;

  // Faces already occupied on an element by pinned arrows we are NOT
  // touching this pass, so the re-anchored arrows don't stack onto them.
  const reserved = new Map<ElementId, Set<Anchor>>();
  const reserve = (id: ElementId, anchor: Anchor) => {
    if (!isCardinal(anchor)) return;
    let set = reserved.get(id);
    if (!set) reserved.set(id, (set = new Set()));
    set.add(anchor);
  };
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    // Reserve faces held by arrows we are NOT re-anchoring this pass, PLUS
    // any manual end of an arrow we ARE re-anchoring (its face is fixed, so
    // the re-anchored ends route around it rather than stacking onto it).
    const skip = reassigning.has(el.id);
    if (el.from.kind === 'pinned' && (!skip || el.from.manual === true)) {
      reserve(el.from.elementId, el.from.anchor);
    }
    if (el.to.kind === 'pinned' && (!skip || el.to.manual === true)) {
      reserve(el.to.elementId, el.to.anchor);
    }
  }

  // Greedy per element: most-committed endpoint claims its best face first,
  // the rest take their next free face. Deterministic tie-break by arrow id.
  const byElement = new Map<ElementId, EndPlan[]>();
  for (const p of plans) {
    let list = byElement.get(p.elementId);
    if (!list) byElement.set(p.elementId, (list = []));
    list.push(p);
  }
  const assigned = new Map<string, Anchor>();
  for (const [elementId, eps] of byElement) {
    const taken = new Set<Anchor>(reserved.get(elementId) ?? []);
    const ordered = [...eps].sort((a, b) =>
      a.commitment === b.commitment
        ? a.arrowId < b.arrowId
          ? -1
          : a.arrowId > b.arrowId
            ? 1
            : a.end < b.end
              ? -1
              : 1
        : b.commitment - a.commitment,
    );
    for (const p of ordered) {
      let face: Cardinal = p.ranked.find((f) => !taken.has(f)) ?? p.ranked[0]!;
      // Stability: stay on the current face while it's still free and within
      // the corner dead-band of the best free face, so a drag doesn't make
      // the arrow hop faces under tiny direction changes.
      if (
        isCardinal(p.current) &&
        !taken.has(p.current) &&
        p.times[p.current] <= p.times[face] * (1 + ANCHOR_SWITCH_MARGIN)
      ) {
        face = p.current;
      }
      taken.add(face);
      assigned.set(`${p.arrowId}:${p.end}`, face);
    }
  }

  return elements.map((el) => {
    if (el.type !== 'arrow' || !reassigning.has(el.id)) return el;
    const fromFace = assigned.get(`${el.id}:from`);
    const toFace = assigned.get(`${el.id}:to`);
    return {
      ...el,
      from: fromFace ? { ...el.from, anchor: fromFace } : el.from,
      to: toFace ? { ...el.to, anchor: toFace } : el.to,
    };
  });
}

// Pick the single cardinal face (n/e/s/w) the centre->`towards` line leaves
// the box through (`ranked[0]` from rankAnchorsTowards). Corners are never
// auto-chosen: the manual anchor dots are cardinal-only too, and arrows read
// cleaner from edge middles.
//
// `current` (the face the arrow already sits on, when re-binding) adds
// hysteresis: the choice only switches axes once the target is decisively
// past the box corner (ANCHOR_SWITCH_MARGIN), so dragging a connected shape
// along the diagonal doesn't make the arrow flicker. A sign flip on the same
// axis (e<->w, n<->s) always commits — the target has crossed the centre, so
// the old face now points away (Infinity) and loses outright.
//
// `avoid` excludes faces already taken by another arrow on the same element,
// so a second connector lands on a free face instead of stacking onto the
// first. A corner `current` falls through to the exact geometric face.
export function bestAnchorTowards(
  element: BoxedElement,
  towards: Point,
  current?: Anchor,
  avoid?: ReadonlySet<Anchor>,
): Anchor {
  const { ranked, times } = rankAnchorsTowards(element, towards);
  const top = (avoid ? ranked.find((f) => !avoid.has(f)) : ranked[0]) ?? ranked[0]!;
  if (
    current &&
    isCardinal(current) &&
    (!avoid || !avoid.has(current)) &&
    times[current] <= times[top] * (1 + ANCHOR_SWITCH_MARGIN)
  ) {
    return current;
  }
  return top;
}

// An id -> element lookup. Callers that resolve many endpoints over
// the same element set (every arrow on a render, every arrow on a
// marquee sweep) build this once and pass it instead of the raw
// array, turning each endpoint resolution from an O(n) `find` into an
// O(1) `get`.
export type ElementIndex = ReadonlyMap<ElementId, Element>;

export function buildElementIndex(elements: Element[]): Map<ElementId, Element> {
  const index = new Map<ElementId, Element>();
  for (const el of elements) index.set(el.id, el);
  return index;
}

// Accepts either the raw element array or a prebuilt index. The array
// overload stays for one-off resolutions (a single drag handle);
// per-element loops should pass an index so the whole pass is O(n)
// rather than O(n^2).
export function endpointPosition(
  endpoint: Endpoint,
  elements: Element[] | ElementIndex,
  // Internal recursion guard: an `on-arrow` endpoint resolves through the
  // target arrow's own endpoints, which could themselves be `on-arrow`. Bail
  // after a few hops so a pathological cycle can't recurse forever.
  depth = 0,
): Point {
  if (endpoint.kind === 'free') return { x: endpoint.x, y: endpoint.y };
  const lookup = (id: ElementId): Element | undefined =>
    elements instanceof Map ? elements.get(id) : (elements as Element[]).find((el) => el.id === id);
  if (endpoint.kind === 'on-arrow') {
    if (depth > 4) return { x: 0, y: 0 };
    const target = lookup(endpoint.arrowId);
    if (!target || target.type !== 'arrow') return { x: 0, y: 0 };
    const from = endpointPosition(target.from, elements, depth + 1);
    const to = endpointPosition(target.to, elements, depth + 1);
    return arrowLabelAnchor(
      arrowStyleOf(target),
      from,
      to,
      target.from,
      target.to,
      target.curveOffset,
      target.elbowOffset,
      { t: endpoint.t, offset: 0 },
      target.curvePoints,
    );
  }
  const target = lookup(endpoint.elementId);
  if (!target || !isBoxed(target)) return { x: 0, y: 0 };
  return anchorPosition(target, endpoint.anchor);
}

export function elementBounds(
  element: Element,
  elements: Element[],
): { x: number; y: number; width: number; height: number } {
  if (isBoxed(element)) {
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  }
  const from = endpointPosition(element.from, elements);
  const to = endpointPosition(element.to, elements);
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}

// Union bounding box of any selection, INCLUDING arrows (their endpoint
// AABB). Unlike `unionBoxedBounds`, which only spans boxed elements, this
// covers arrow-only / mixed selections — used to anchor the floating
// selection toolbar over a marquee that grabbed arrows. Returns null when
// no listed id matches.
export function unionElementBounds(
  elements: Element[],
  ids: Set<ElementId>,
): { x: number; y: number; width: number; height: number } | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let found = false;
  for (const el of elements) {
    if (!ids.has(el.id)) continue;
    found = true;
    const b = elementBounds(el, elements);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  if (!found) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
