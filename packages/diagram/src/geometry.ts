import {
  ALL_ANCHORS,
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

// Works on any boxed element since they share x/y/width/height. When the
// element carries a `rotation`, the anchor is rotated about the
// element's centre so a pinned arrow lands on the visually-rotated edge,
// not the pre-rotation position. Every pinned endpoint (rendering) and
// snapToAnchor (pinning) resolve through here, so they stay consistent.
export function anchorPosition(element: BoxedElement, anchor: Anchor): Point {
  const { x, y, width, height } = element;
  const local = localAnchorPosition(x, y, width, height, anchor);
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
    reassigning.add(el.id);
    plans.push({
      arrowId: el.id,
      end: 'from',
      elementId: fromEl.id,
      current: el.from.anchor,
      ...rankAnchorsTowards(fromEl, centreOf(toEl)),
    });
    plans.push({
      arrowId: el.id,
      end: 'to',
      elementId: toEl.id,
      current: el.to.anchor,
      ...rankAnchorsTowards(toEl, centreOf(fromEl)),
    });
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
    if (el.type !== 'arrow' || reassigning.has(el.id)) continue;
    if (el.from.kind === 'pinned') reserve(el.from.elementId, el.from.anchor);
    if (el.to.kind === 'pinned') reserve(el.to.elementId, el.to.anchor);
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
export function endpointPosition(endpoint: Endpoint, elements: Element[] | ElementIndex): Point {
  if (endpoint.kind === 'free') return { x: endpoint.x, y: endpoint.y };
  const target =
    elements instanceof Map
      ? elements.get(endpoint.elementId)
      : (elements as Element[]).find((el) => el.id === endpoint.elementId);
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

// Alignment snapping: when dragging an element, snap its edges/centre to
// match nearby OTHER elements' edges/centres on the same axis. Returns the
// delta (dx, dy) to apply to the candidate position.
//
// Considers six lines per element: left / centre-x / right (X axis) and
// top / centre-y / bottom (Y axis). For each axis, picks the nearest
// candidate-target pair within `threshold` pixels.
export function snapToAlignment(
  candidate: { x: number; y: number; width: number; height: number },
  elements: Element[],
  excludeIds: Set<ElementId>,
  threshold: number,
): { dx: number; dy: number; snappedX: boolean; snappedY: boolean } {
  const xs = [candidate.x, candidate.x + candidate.width / 2, candidate.x + candidate.width];
  const ys = [candidate.y, candidate.y + candidate.height / 2, candidate.y + candidate.height];

  let bestX: number | null = null;
  let bestY: number | null = null;

  for (const el of elements) {
    if (!isBoxed(el) || excludeIds.has(el.id)) continue;
    const targetXs = [el.x, el.x + el.width / 2, el.x + el.width];
    const targetYs = [el.y, el.y + el.height / 2, el.y + el.height];
    for (const cx of xs) {
      for (const tx of targetXs) {
        const delta = tx - cx;
        if (Math.abs(delta) <= threshold && (bestX === null || Math.abs(delta) < Math.abs(bestX))) {
          bestX = delta;
        }
      }
    }
    for (const cy of ys) {
      for (const ty of targetYs) {
        const delta = ty - cy;
        if (Math.abs(delta) <= threshold && (bestY === null || Math.abs(delta) < Math.abs(bestY))) {
          bestY = delta;
        }
      }
    }
  }

  // snappedX/Y report whether an alignment was FOUND on that axis, which
  // a 0 delta can't convey (an exact alignment and "nothing in range"
  // both yield dx 0). Callers that layer another snap (e.g. distribution)
  // use these to tell "already aligned, leave it" from "free, go ahead".
  return { dx: bestX ?? 0, dy: bestY ?? 0, snappedX: bestX !== null, snappedY: bestY !== null };
}

// Snap candidate bounds during a resize to align with other elements'
// edges, centres, and dimensions. Mirrors `snapToAlignment` but only
// nudges the edges that the active resize handle actually moves
// (the opposite corner is anchored and must not drift). Threshold
// is in canvas px.
//
// Two snap modes combine on each axis, with the smaller delta winning
// when they conflict:
//   1. Edge alignment: the active edge lines up with another element's
//      left / centre / right (or top / centre / bottom).
//   2. Dimension match: the candidate's width (or height) matches
//      another element's width (or height), so the user can size a
//      shape to be visually identical to a nearby one without
//      pixel-fiddling.
//
// `mode` is the corner being dragged ("se" = bottom-right handle =
// right + bottom edges move; etc.).
export function snapResizeBounds(
  candidate: { x: number; y: number; width: number; height: number },
  // Corner modes move two edges; single-edge modes (n/s/e/w) move one,
  // snapping (and dimension-matching) on that axis only.
  mode: 'se' | 'sw' | 'ne' | 'nw' | 'n' | 's' | 'e' | 'w',
  elements: Element[],
  excludeIds: Set<ElementId>,
  threshold: number,
  minSize: number,
): { x: number; y: number; width: number; height: number } {
  const movesRight = mode === 'se' || mode === 'ne' || mode === 'e';
  const movesLeft = mode === 'sw' || mode === 'nw' || mode === 'w';
  const movesBottom = mode === 'se' || mode === 'sw' || mode === 's';
  const movesTop = mode === 'ne' || mode === 'nw' || mode === 'n';

  // Anchored coordinates, the corner that should NOT move.
  const anchorRight = movesLeft ? candidate.x + candidate.width : null;
  const anchorLeft = movesRight ? candidate.x : null;
  const anchorBottom = movesTop ? candidate.y + candidate.height : null;
  const anchorTop = movesBottom ? candidate.y : null;

  // The active edge positions we'll try to snap.
  const activeX = movesRight ? candidate.x + candidate.width : candidate.x;
  const activeY = movesBottom ? candidate.y + candidate.height : candidate.y;

  let bestDx: number | null = null;
  let bestDy: number | null = null;

  for (const el of elements) {
    if (!isBoxed(el) || excludeIds.has(el.id)) continue;
    const targetXs = [el.x, el.x + el.width / 2, el.x + el.width];
    const targetYs = [el.y, el.y + el.height / 2, el.y + el.height];
    if (movesLeft || movesRight) {
      for (const tx of targetXs) {
        const delta = tx - activeX;
        if (
          Math.abs(delta) <= threshold &&
          (bestDx === null || Math.abs(delta) < Math.abs(bestDx))
        ) {
          bestDx = delta;
        }
      }
      // Dimension match: translate "candidate.width should equal
      // el.width" into a delta on the active X edge. movesRight
      // pushes the active edge to anchorLeft + el.width; movesLeft
      // pulls it to anchorRight - el.width. Skip degenerate sources
      // (zero-width elements would always be within threshold and
      // confuse the user).
      if (el.width > 0) {
        const targetActiveX =
          movesRight && anchorLeft !== null
            ? anchorLeft + el.width
            : movesLeft && anchorRight !== null
              ? anchorRight - el.width
              : null;
        if (targetActiveX !== null) {
          const delta = targetActiveX - activeX;
          if (
            Math.abs(delta) <= threshold &&
            (bestDx === null || Math.abs(delta) < Math.abs(bestDx))
          ) {
            bestDx = delta;
          }
        }
      }
    }
    if (movesTop || movesBottom) {
      for (const ty of targetYs) {
        const delta = ty - activeY;
        if (
          Math.abs(delta) <= threshold &&
          (bestDy === null || Math.abs(delta) < Math.abs(bestDy))
        ) {
          bestDy = delta;
        }
      }
      if (el.height > 0) {
        const targetActiveY =
          movesBottom && anchorTop !== null
            ? anchorTop + el.height
            : movesTop && anchorBottom !== null
              ? anchorBottom - el.height
              : null;
        if (targetActiveY !== null) {
          const delta = targetActiveY - activeY;
          if (
            Math.abs(delta) <= threshold &&
            (bestDy === null || Math.abs(delta) < Math.abs(bestDy))
          ) {
            bestDy = delta;
          }
        }
      }
    }
  }

  let { x, y, width, height } = candidate;
  if (bestDx !== null) {
    if (movesRight && anchorLeft !== null) {
      width = Math.max(minSize, activeX + bestDx - anchorLeft);
    } else if (movesLeft && anchorRight !== null) {
      const newX = activeX + bestDx;
      const newWidth = Math.max(minSize, anchorRight - newX);
      x = anchorRight - newWidth;
      width = newWidth;
    }
  }
  if (bestDy !== null) {
    if (movesBottom && anchorTop !== null) {
      height = Math.max(minSize, activeY + bestDy - anchorTop);
    } else if (movesTop && anchorBottom !== null) {
      const newY = activeY + bestDy;
      const newHeight = Math.max(minSize, anchorBottom - newY);
      y = anchorBottom - newHeight;
      height = newHeight;
    }
  }
  return { x, y, width, height };
}

// A faint line the canvas draws while an element is being dragged /
// resized to show WHY it snapped to a given position: it lies along an
// edge / centre line the dragged element now shares with one or more
// neighbours. `axis: 'x'` is a vertical line at constant x; `axis: 'y'`
// is a horizontal line at constant y. `start`/`end` are the inclusive
// span on the perpendicular axis (top→bottom for a vertical line,
// left→right for a horizontal one) so the guide bridges only the
// aligned elements rather than crossing the whole canvas.
export type AlignmentGuide = {
  axis: 'x' | 'y';
  position: number;
  start: number;
  end: number;
};

// Derive the alignment guides for an element at `candidate` bounds
// against its neighbours. Decoupled from snapToAlignment /
// snapResizeBounds on purpose: callers pass the ALREADY-SNAPPED bounds,
// and this reports every candidate line (left / centre-x / right on X,
// top / centre-y / bottom on Y) that now coincides with a neighbour's
// line within `epsilon` pixels. Because it keys off the snapped
// position, a guide surfaces exactly when a snap is in effect — there's
// no separate "is the snap active" flag to keep in sync.
//
// `excludeIds` skips the dragged elements (so a group drag never guides
// against itself). Each returned guide spans the union extent of the
// candidate plus every matched neighbour on the perpendicular axis.
// Lines at the same axis + position are merged into one.
export function alignmentGuides(
  candidate: { x: number; y: number; width: number; height: number },
  elements: Element[],
  excludeIds: Set<ElementId>,
  epsilon = 0.5,
): AlignmentGuide[] {
  const candidateXs = [
    candidate.x,
    candidate.x + candidate.width / 2,
    candidate.x + candidate.width,
  ];
  const candidateYs = [
    candidate.y,
    candidate.y + candidate.height / 2,
    candidate.y + candidate.height,
  ];
  const candidateTop = candidate.y;
  const candidateBottom = candidate.y + candidate.height;
  const candidateLeft = candidate.x;
  const candidateRight = candidate.x + candidate.width;

  // Keyed by `${axis}:${roundedPosition}` so duplicate lines (e.g. left
  // edge AND centre landing on the same x) collapse and their spans merge.
  const guides = new Map<string, AlignmentGuide>();

  const record = (axis: 'x' | 'y', position: number, start: number, end: number) => {
    const key = `${axis}:${Math.round(position)}`;
    const existing = guides.get(key);
    if (existing) {
      existing.start = Math.min(existing.start, start);
      existing.end = Math.max(existing.end, end);
    } else {
      guides.set(key, { axis, position, start, end });
    }
  };

  // One pass per axis (was one pass per candidate line, i.e. 3 + 3 =
  // 6 full element scans). For each element we test all three
  // candidate lines at once and accumulate that line's span. The
  // record() order (x lines in candidate order, then y lines) and the
  // min/max span accumulation are unchanged, so the output is
  // identical, two scans instead of six.
  const xStart = [candidateTop, candidateTop, candidateTop];
  const xEnd = [candidateBottom, candidateBottom, candidateBottom];
  const xMatched = [false, false, false];
  for (const el of elements) {
    if (!isBoxed(el) || excludeIds.has(el.id)) continue;
    const e0 = el.x;
    const e1 = el.x + el.width / 2;
    const e2 = el.x + el.width;
    const top = el.y;
    const bottom = el.y + el.height;
    for (let i = 0; i < 3; i++) {
      const lineX = candidateXs[i]!;
      if (
        Math.abs(e0 - lineX) <= epsilon ||
        Math.abs(e1 - lineX) <= epsilon ||
        Math.abs(e2 - lineX) <= epsilon
      ) {
        xMatched[i] = true;
        xStart[i] = Math.min(xStart[i]!, top);
        xEnd[i] = Math.max(xEnd[i]!, bottom);
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    if (xMatched[i]) record('x', candidateXs[i]!, xStart[i]!, xEnd[i]!);
  }

  const yStart = [candidateLeft, candidateLeft, candidateLeft];
  const yEnd = [candidateRight, candidateRight, candidateRight];
  const yMatched = [false, false, false];
  for (const el of elements) {
    if (!isBoxed(el) || excludeIds.has(el.id)) continue;
    const e0 = el.y;
    const e1 = el.y + el.height / 2;
    const e2 = el.y + el.height;
    const left = el.x;
    const right = el.x + el.width;
    for (let i = 0; i < 3; i++) {
      const lineY = candidateYs[i]!;
      if (
        Math.abs(e0 - lineY) <= epsilon ||
        Math.abs(e1 - lineY) <= epsilon ||
        Math.abs(e2 - lineY) <= epsilon
      ) {
        yMatched[i] = true;
        yStart[i] = Math.min(yStart[i]!, left);
        yEnd[i] = Math.max(yEnd[i]!, right);
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    if (yMatched[i]) record('y', candidateYs[i]!, yStart[i]!, yEnd[i]!);
  }

  return [...guides.values()];
}

// Equal-spacing ("distribution") guide: the equal gaps the moving element
// shares with its neighbours along one axis — Figma's pink equal-distance
// guides. `gap` is the matched spacing; `spans` are the gap segments to
// draw (each runs `from`->`to` along `axis` at the perpendicular `cross`),
// tick-capped so the equal gaps read at a glance.
export type DistributionGuide = {
  axis: 'x' | 'y';
  gap: number;
  spans: { from: number; to: number; cross: number }[];
};

type DistAxisItem = { low: number; high: number; crossLow: number; crossHigh: number };
type DistAxisResult = { delta: number; gap: number; spans: { from: number; to: number }[] };

// Per-axis equal-spacing search. `cand` is the moving element's interval
// on the primary axis (low + size) plus its span on the cross axis;
// `items` are the other elements' intervals. Only neighbours that overlap
// the candidate on the cross axis count (so X-spacing considers a
// horizontal row, Y-spacing a vertical column). Returns the smallest snap
// within `threshold` that makes a gap equal, or null.
function distributeAxis(
  cand: { low: number; size: number; crossLow: number; crossHigh: number },
  items: DistAxisItem[],
  threshold: number,
): DistAxisResult | null {
  const row = items.filter((n) => n.crossLow < cand.crossHigh && n.crossHigh > cand.crossLow);
  const cHigh = cand.low + cand.size;
  let best: DistAxisResult | null = null;
  const consider = (delta: number, gap: number, spans: { from: number; to: number }[]) => {
    if (gap < 1 || Math.abs(delta) > threshold) return;
    if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, gap, spans };
  };
  // Equidistant: a neighbour P to the left and Q to the right; centre the
  // candidate in the gap so the two facing gaps are equal.
  for (const P of row) {
    if (P.high > cand.low + threshold) continue;
    for (const Q of row) {
      if (Q.low < cHigh - threshold || Q.low <= P.high) continue;
      const gap = (Q.low - P.high - cand.size) / 2;
      const targetLow = P.high + gap;
      consider(targetLow - cand.low, gap, [
        { from: P.high, to: targetLow },
        { from: targetLow + cand.size, to: Q.low },
      ]);
    }
  }
  // Equal extension: an adjacent neighbour pair (P, Q) defines a gap;
  // snap the candidate one gap beyond Q (to the right) or before P (left).
  const sorted = [...row].sort((a, b) => a.low - b.low);
  for (let i = 0; i + 1 < sorted.length; i++) {
    const P = sorted[i]!;
    const Q = sorted[i + 1]!;
    if (Q.low <= P.high) continue;
    const gap = Q.low - P.high;
    if (cand.low + cand.size / 2 > Q.high) {
      const targetLow = Q.high + gap;
      consider(targetLow - cand.low, gap, [
        { from: P.high, to: Q.low },
        { from: Q.high, to: targetLow },
      ]);
    }
    if (cand.low + cand.size / 2 < P.low) {
      const targetLow = P.low - gap - cand.size;
      consider(targetLow - cand.low, gap, [
        { from: targetLow + cand.size, to: P.low },
        { from: P.high, to: Q.low },
      ]);
    }
  }
  return best;
}

// Snap a dragged element to EQUAL spacing with its neighbours (so three
// elements end up evenly spread) and report the gap segments to draw.
// Pure; mirrors snapToAlignment's shape (a dx/dy nudge) but for
// inter-element spacing rather than edge/centre alignment. Each axis is
// considered independently.
export function distributionSnap(
  candidate: { x: number; y: number; width: number; height: number },
  elements: Element[],
  excludeIds: Set<ElementId>,
  threshold: number,
): { dx: number; dy: number; guides: DistributionGuide[] } {
  const boxed = elements.filter((el): el is BoxedElement => isBoxed(el) && !excludeIds.has(el.id));
  const xs = distributeAxis(
    {
      low: candidate.x,
      size: candidate.width,
      crossLow: candidate.y,
      crossHigh: candidate.y + candidate.height,
    },
    boxed.map((el) => ({
      low: el.x,
      high: el.x + el.width,
      crossLow: el.y,
      crossHigh: el.y + el.height,
    })),
    threshold,
  );
  const ys = distributeAxis(
    {
      low: candidate.y,
      size: candidate.height,
      crossLow: candidate.x,
      crossHigh: candidate.x + candidate.width,
    },
    boxed.map((el) => ({
      low: el.y,
      high: el.y + el.height,
      crossLow: el.x,
      crossHigh: el.x + el.width,
    })),
    threshold,
  );
  const dx = xs?.delta ?? 0;
  const dy = ys?.delta ?? 0;
  const guides: DistributionGuide[] = [];
  if (xs) {
    const cross = candidate.y + dy + candidate.height / 2;
    guides.push({ axis: 'x', gap: xs.gap, spans: xs.spans.map((s) => ({ ...s, cross })) });
  }
  if (ys) {
    const cross = candidate.x + dx + candidate.width / 2;
    guides.push({ axis: 'y', gap: ys.gap, spans: ys.spans.map((s) => ({ ...s, cross })) });
  }
  return { dx, dy, guides };
}

// Nearest boxed-element anchor to a canvas point. Returns the pinning
// reference if one is within `threshold` pixels; otherwise null.
export function snapToAnchor(
  point: Point,
  elements: Element[],
  threshold: number,
): { elementId: ElementId; anchor: Anchor } | null {
  // Compare squared distances throughout (Math.hypot is markedly
  // slower and we only need the ordering / the threshold test).
  const thresholdSq = threshold * threshold;
  let best: { elementId: ElementId; anchor: Anchor; distSq: number } | null = null;
  for (const el of elements) {
    if (!isBoxed(el)) continue;
    // Bounding-radius pre-reject: every anchor (corner, edge-mid, or
    // centre) sits within R = half the element's diagonal of its
    // centre, for ANY rotation. So if the point is farther than
    // R + threshold from the centre, no anchor can be in range — skip
    // the 8-anchor inner loop entirely. Conservative, so it never
    // changes the result, only avoids work on distant elements.
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const radius = Math.hypot(el.width, el.height) / 2;
    const reach = radius + threshold;
    const dcx = cx - point.x;
    const dcy = cy - point.y;
    if (dcx * dcx + dcy * dcy > reach * reach) continue;
    for (const anchor of ALL_ANCHORS) {
      const pos = anchorPosition(el, anchor);
      const dx = pos.x - point.x;
      const dy = pos.y - point.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= thresholdSq && (best === null || distSq < best.distSq)) {
        best = { elementId: el.id, anchor, distSq };
      }
    }
  }
  if (!best) return null;
  return { elementId: best.elementId, anchor: best.anchor };
}
