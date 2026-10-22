// The blocks an infographic page's Tidy Up moves (docs/specs/007-editor/pages-mode.md "Tidy";
// lib/page-tidy.ts): the page's elements as a forest, each element carrying what it wholly holds,
// and the rect arithmetic the steps share.
import { type BoxedElement, type ElementId } from '@livedesign/document';
import { SQUARE_SHAPES } from './auto-align';

// Below this, two values are the same (float noise from the layouts' own arithmetic).
export const SAME = 0.05;
// An overlap or a containment is counted past half a pixel, so touching is neither.
export const EPS = 0.5;

export type Rect = { x: number; y: number; width: number; height: number };
export type Axis = 'x' | 'y';

export type Block = {
  id: ElementId;
  rect: Rect;
  // Where it started at this level (the guard's way back).
  start: Rect;
  // May move at this level: unlocked, unrotated, nothing locked inside it, not sent back.
  movable: boolean;
  // May have its size rounded: a shape or sticky with nothing inside it, whose shape keeps no ratio.
  resizable: boolean;
  children: Block[];
};

const right = (r: Rect) => r.x + r.width;
const bottom = (r: Rect) => r.y + r.height;
const area = (r: Rect) => r.width * r.height;
export const rectOf = (el: BoxedElement): Rect => ({
  x: el.x,
  y: el.y,
  width: el.width,
  height: el.height,
});
export const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - EPS &&
  inner.y >= outer.y - EPS &&
  right(inner) <= right(outer) + EPS &&
  bottom(inner) <= bottom(outer) + EPS;
export const overlaps = (a: Rect, b: Rect) =>
  a.x < right(b) - EPS && b.x < right(a) - EPS && a.y < bottom(b) - EPS && b.y < bottom(a) - EPS;
export const sameRect = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) < SAME &&
  Math.abs(a.y - b.y) < SAME &&
  Math.abs(a.width - b.width) < SAME &&
  Math.abs(a.height - b.height) < SAME;

// The rect's start, size and the three lines along an axis.
export const lo = (r: Rect, a: Axis) => (a === 'x' ? r.x : r.y);
export const size = (r: Rect, a: Axis) => (a === 'x' ? r.width : r.height);
export const other = (a: Axis): Axis => (a === 'x' ? 'y' : 'x');
export const FEATURES = ['start', 'centre', 'end'] as const;
type Feature = (typeof FEATURES)[number];
export const featureOf = (r: Rect, a: Axis, f: Feature) =>
  lo(r, a) + (f === 'start' ? 0 : f === 'centre' ? size(r, a) / 2 : size(r, a));

// Moves a block and everything inside it.
export function shift(b: Block, dx: number, dy: number) {
  if (dx === 0 && dy === 0) return;
  b.rect = { ...b.rect, x: b.rect.x + dx, y: b.rect.y + dy };
  for (const c of b.children) shift(c, dx, dy);
}
export const shiftAlong = (b: Block, a: Axis, d: number) =>
  a === 'x' ? shift(b, d, 0) : shift(b, 0, d);

const isPinned = (el: BoxedElement, lockedIds: ReadonlySet<ElementId>) =>
  lockedIds.has(el.id) || ((el as { rotation?: number }).rotation ?? 0) % 360 !== 0;

// A shape or sticky whose size may round without distorting it: not a square shape, not
// aspect-locked. Text (it would rewrap), images and the rest keep theirs.
const sizeRoundable = (el: BoxedElement) =>
  (el.type === 'sticky' || (el.type === 'shape' && !SQUARE_SHAPES.has(el.shape))) &&
  el.aspectLocked !== true;

// The forest of blocks: each element's parent is the smallest other (non-text) element wholly
// holding it and strictly larger. O(n²) in the page's elements.
export function blocksOf(els: BoxedElement[], lockedIds: ReadonlySet<ElementId>): Block[] {
  const rects = els.map(rectOf);
  const parent = els.map((_, i) => {
    let best = -1;
    for (let j = 0; j < els.length; j++) {
      if (j === i || els[j]!.type === 'text') continue;
      if (area(rects[j]!) <= area(rects[i]!) + SAME || !contains(rects[j]!, rects[i]!)) continue;
      if (best < 0 || area(rects[j]!) < area(rects[best]!)) best = j;
    }
    return best;
  });
  const blocks: Block[] = els.map((el, i) => ({
    id: el.id,
    rect: rects[i]!,
    start: rects[i]!,
    movable: !isPinned(el, lockedIds),
    resizable: sizeRoundable(el),
    children: [],
  }));
  const roots: Block[] = [];
  blocks.forEach((b, i) =>
    parent[i]! >= 0 ? blocks[parent[i]!]!.children.push(b) : roots.push(b),
  );
  // A block carrying anything pinned cannot move as one (its pinned part would go with it), and a
  // block with anything inside it keeps its size.
  const settle = (b: Block): boolean => {
    let pinnedInside = false;
    for (const c of b.children) pinnedInside = settle(c) || pinnedInside;
    if (b.children.length > 0) b.resizable = false;
    if (pinnedInside) b.movable = false;
    return !b.movable || pinnedInside;
  };
  roots.forEach(settle);
  return roots;
}
