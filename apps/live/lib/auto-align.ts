// Auto-align ("Cleanup → Auto align" in the Current Tab settings):
// snap every boxed element's position and dimensions to the grid so
// near-aligned shapes become exactly aligned and minor drift
// collapses. Free-endpoint arrows snap their endpoints to the same
// grid; pinned arrow endpoints stay attached to their elements
// (which themselves get snapped, so the arrow follows).
//
// Grid unit is 10 px. That matches the canvas's "you basically can't
// see drift of less than 10 px" threshold and is the same step the
// other snap helpers use as their floor.

import { MIN_SIZE } from './canvas';
import { isBoxed, type BoxedElement, type Element } from '@livediagram/diagram';

// Snap step in canvas pixels. Picked so the rounding is visible
// enough to tidy up drift (a 3 px misalignment becomes 0 or 10) but
// not so coarse that intentionally-sized elements get re-shaped.
export const AUTO_ALIGN_GRID = 10;

const snap = (value: number): number => Math.round(value / AUTO_ALIGN_GRID) * AUTO_ALIGN_GRID;

// Shape kinds whose silhouette assumes a 1:1 aspect ratio. Snapping
// width and height independently would warp them, so we snap the
// larger side and force the other to match.
const SQUARE_SHAPES = new Set(['circle', 'diamond', 'actor']);

// Apply the cleanup pass to one element. Pure, idempotent, and
// leaves non-boxed-non-arrow elements unchanged.
export function autoAlignElement(el: Element): Element {
  if (isBoxed(el)) {
    let width = Math.max(MIN_SIZE, snap(el.width));
    let height = Math.max(MIN_SIZE, snap(el.height));
    // Aspect-locked-by-shape elements stay square. Use the larger of
    // the two snapped sides so a "tall-ish circle" becomes a circle
    // around the taller axis (snapping down would shrink it past
    // user intent more often than snapping up).
    if (el.type === 'shape' && SQUARE_SHAPES.has(el.shape)) {
      const side = Math.max(width, height);
      width = side;
      height = side;
    }
    // Explicit aspect-lock (textually editable shapes that the user
    // pinned via the Aspect-lock toggle). Same square-snap rule;
    // we preserve the ratio not by shape but by user intent.
    if (el.aspectLocked === true) {
      const ratio = el.width / Math.max(1, el.height);
      // Pick which axis to drive: the larger absolute change wins,
      // so dragging a 197 x 100 shape to "200 x 100" stays roughly
      // 2:1 rather than collapsing to a square.
      const useW = Math.abs(width - el.width) >= Math.abs(height - el.height);
      if (useW) height = Math.max(MIN_SIZE, snap(width / ratio));
      else width = Math.max(MIN_SIZE, snap(height * ratio));
    }
    return {
      ...el,
      x: snap(el.x),
      y: snap(el.y),
      width,
      height,
    };
  }
  if (el.type === 'arrow') {
    return {
      ...el,
      // Pinned endpoints stay attached to their elements (the
      // element itself just got snapped, so the arrow follows).
      // Free endpoints snap to the grid like any other coord.
      from:
        el.from.kind === 'free'
          ? { kind: 'free', x: snap(el.from.x), y: snap(el.from.y) }
          : el.from,
      to: el.to.kind === 'free' ? { kind: 'free', x: snap(el.to.x), y: snap(el.to.y) } : el.to,
    };
  }
  return el;
}

// --- Aggressive tab cleanup ------------------------------------------------
//
// Per-element grid snap (above) only collapses sub-grid drift, which is
// barely visible. The tab-level cleanup goes further: it unifies the
// sizes of same-type elements that are already close, then pulls
// near-aligned edges / centres onto shared lines so rows and columns
// read as deliberately aligned. Both passes are bounded by a tolerance
// so genuinely-different elements (a title vs body cards, a far-away
// note) are left alone.

// Elements whose edge/centre sit within this many px of each other snap
// to a shared line. Same window unifies same-type sizes. Generous enough
// to tidy a hand-placed layout, tight enough not to merge distinct rows.
const ALIGN_TOLERANCE = 24;

// A key grouping "content of the same type" for size normalisation:
// each shape kind is its own group; text / sticky / image group by kind.
function typeKey(el: Element): string {
  return el.type === 'shape' ? `shape:${el.shape}` : el.type;
}

// Gap-based 1D clustering. Returns, per input value, its cluster
// representative (the grid-snapped mean) plus the cluster's member
// count. A new cluster starts when the gap to the previous value
// exceeds `tolerance`, so a tight run collapses to one line while a
// real gap stays split.
function clusterReps(
  values: number[],
  tolerance: number,
): Map<number, { rep: number; count: number }> {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const out = new Map<number, { rep: number; count: number }>();
  let group: number[] = [];
  const flush = () => {
    if (group.length === 0) return;
    const rep = snap(group.reduce((sum, v) => sum + v, 0) / group.length);
    const entry = { rep, count: group.length };
    for (const v of group) out.set(v, entry);
    group = [];
  };
  for (const v of sorted) {
    if (group.length > 0 && v - group[group.length - 1]! > tolerance) flush();
    group.push(v);
  }
  flush();
  return out;
}

// Unify the sizes of same-type elements whose dimensions land in the
// same cluster, so a row of "roughly 200x100" cards becomes exactly
// uniform. Square shapes unify their single side; aspect-locked elements
// keep their ratio off the unified width.
function normalizeSizes(elements: Element[]): Element[] {
  const byType = new Map<string, { width: number[]; height: number[] }>();
  for (const el of elements) {
    if (!isBoxed(el)) continue;
    const key = typeKey(el);
    const bucket = byType.get(key) ?? { width: [], height: [] };
    bucket.width.push(el.width);
    bucket.height.push(el.height);
    byType.set(key, bucket);
  }
  const widthCl = new Map<string, Map<number, { rep: number; count: number }>>();
  const heightCl = new Map<string, Map<number, { rep: number; count: number }>>();
  for (const [key, dims] of byType) {
    widthCl.set(key, clusterReps(dims.width, ALIGN_TOLERANCE));
    heightCl.set(key, clusterReps(dims.height, ALIGN_TOLERANCE));
  }
  return elements.map((el) => {
    if (!isBoxed(el)) return el;
    const key = typeKey(el);
    let width = Math.max(MIN_SIZE, widthCl.get(key)?.get(el.width)?.rep ?? el.width);
    let height = Math.max(MIN_SIZE, heightCl.get(key)?.get(el.height)?.rep ?? el.height);
    if (el.type === 'shape' && SQUARE_SHAPES.has(el.shape)) {
      const side = Math.max(width, height);
      width = side;
      height = side;
    } else if (el.aspectLocked === true) {
      const ratio = el.width / Math.max(1, el.height);
      height = Math.max(MIN_SIZE, snap(width / ratio));
    }
    return { ...el, width, height };
  });
}

// Pull near-aligned boxed elements onto shared lines on one axis. For
// each element we consider aligning its low edge, centre, or high edge
// to a multi-member cluster, and apply whichever needs the smallest
// shift (so an element joins the row/column it's closest to, and isolated
// elements with no shared line don't move).
function alignAxis(
  elements: Element[],
  lowOf: (el: BoxedElement) => number,
  sizeOf: (el: BoxedElement) => number,
  shift: (el: BoxedElement, delta: number) => Element,
): Element[] {
  const boxed = elements.filter(isBoxed);
  if (boxed.length < 2) return elements;
  const lows = clusterReps(
    boxed.map((e) => lowOf(e)),
    ALIGN_TOLERANCE,
  );
  const highs = clusterReps(
    boxed.map((e) => lowOf(e) + sizeOf(e)),
    ALIGN_TOLERANCE,
  );
  return elements.map((el) => {
    if (!isBoxed(el)) return el;
    const low = lowOf(el);
    const size = sizeOf(el);
    // Candidate shifts toward each shared (>=2 member) line. Only the low
    // and high edges are used (not the centre): their cluster reps are
    // grid-snapped, so aligning to them keeps the element on the grid and
    // the whole pass idempotent (a centre rep would land x off-grid, and
    // the grid-snap baseline would then fight it on the next run).
    const candidates: number[] = [];
    const l = lows.get(low);
    if (l && l.count >= 2) candidates.push(l.rep - low);
    const h = highs.get(low + size);
    if (h && h.count >= 2) candidates.push(h.rep - (low + size));
    if (candidates.length === 0) return el;
    // Smallest move wins: align to the nearest shared line.
    const delta = candidates.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
    return delta === 0 ? el : shift(el, delta);
  });
}

// Top-level entry: aggressive cleanup across an entire tab.
// `Element[] in, Element[] out`, so the editor can drop it through
// `commit()` and pick up undo / activity-log behaviour for free.
// Order matters: grid-snap baseline first, then unify sizes (alignment
// reads the unified widths/heights), then align edges on each axis.
export function autoAlignElements(elements: Element[]): Element[] {
  let result = elements.map(autoAlignElement);
  result = normalizeSizes(result);
  result = alignAxis(
    result,
    (el) => el.x,
    (el) => el.width,
    (el, delta) => ({ ...el, x: el.x + delta }),
  );
  result = alignAxis(
    result,
    (el) => el.y,
    (el) => el.height,
    (el, delta) => ({ ...el, y: el.y + delta }),
  );
  return result;
}
