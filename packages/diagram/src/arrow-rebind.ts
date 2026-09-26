import type { Anchor, ArrowElement, BoxedElement, Element, ElementId, Endpoint } from './index';
import { anchorClass, anchorLiesOn, anchorsOf } from './anchors';
import { anchorAimPoint, exitSideTowards } from './anchor-choice';
import { arrowPolyline, pathPassesThrough, pinnedBoxedElement } from './arrow-path-hits';
import { swapCrossingEnds } from './arrow-rebind-swap';
import {
  anchorPosition,
  buildElementIndex,
  centreOf,
  endpointPosition,
  type ElementIndex,
} from './geometry';
import type { Point } from './geometry-primitives';

// THE AUTO-REBIND (docs/specs/008-canvas/arrow-anchors.md "Auto-rebind").
//
// After a move, an arrow attached to a moved element is looked at, and only
// one thing makes it change: its DRAWN path now runs through the shape of
// one of its pinned ends. Then each pinned end moves to the side facing the
// other end, keeping its position class (corner / quarter / middle); an end
// already on that side stays. Afterwards, two ends on one side of one shape
// whose paths cross trade anchors (arrow-rebind-swap.ts).
//
// Pure, and memoryless: every run starts from the anchors as they are, so
// an end that moved never drifts back. Runs on every drag frame.

// Two candidate anchors whose distances to the other end differ by no more
// than this are equally close; the one nearer the previous anchor wins.
export const CLOSENESS_TIE_PX = 0.5;

// Pinned ends per element per anchor: what "another arrow holds it" reads.
type HeldAnchors = Map<ElementId, Map<Anchor, number>>;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// Considered: an end pinned to a moved element, not a self-loop, and not an
// arrow whose two pinned ends moved together (it translated rigidly).
function isConsidered(arrow: ArrowElement, moving: (id: ElementId) => boolean): boolean {
  const { from, to } = arrow;
  const fromMoved = from.kind === 'pinned' && moving(from.elementId);
  const toMoved = to.kind === 'pinned' && moving(to.elementId);
  if (!fromMoved && !toMoved) return false;
  if (from.kind === 'pinned' && to.kind === 'pinned' && from.elementId === to.elementId) {
    return false;
  }
  return !(fromMoved && toMoved);
}

// Every pinned end of every arrow, counted per element and anchor.
function countHeld(elements: Element[]): HeldAnchors {
  const held: HeldAnchors = new Map();
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    for (const ep of [el.from, el.to]) {
      if (ep.kind !== 'pinned') continue;
      let counts = held.get(ep.elementId);
      if (!counts) held.set(ep.elementId, (counts = new Map()));
      counts.set(ep.anchor, (counts.get(ep.anchor) ?? 0) + 1);
    }
  }
  return held;
}

function moveHeld(held: HeldAnchors, elementId: ElementId, from: Anchor, to: Anchor) {
  const counts = held.get(elementId);
  if (!counts) return;
  counts.set(from, (counts.get(from) ?? 1) - 1);
  counts.set(to, (counts.get(to) ?? 0) + 1);
}

// Of the two same-class anchors on the facing side: the one closer to the
// other end (ties to the one nearer the previous anchor), unless another
// arrow holds it; then the other; both held, the closer.
function pickCandidate(
  el: BoxedElement,
  current: Anchor,
  candidates: readonly Anchor[],
  reference: Point,
  held: HeldAnchors,
): Anchor {
  if (candidates.length === 1) return candidates[0]!;
  const previous = anchorPosition(el, current);
  const scored = candidates.map((anchor) => {
    const at = anchorPosition(el, anchor);
    return { anchor, toOther: dist(at, reference), toPrevious: dist(at, previous) };
  });
  scored.sort((a, b) =>
    Math.abs(a.toOther - b.toOther) <= CLOSENESS_TIE_PX
      ? a.toPrevious - b.toPrevious
      : a.toOther - b.toOther,
  );
  const counts = held.get(el.id);
  return (scored.find((s) => !counts?.get(s.anchor)) ?? scored[0]!).anchor;
}

// Re-evaluate one pinned end of a triggered arrow.
function reanchorEnd(
  arrowId: ElementId,
  end: 'from' | 'to',
  ep: Endpoint,
  other: Endpoint,
  index: ElementIndex,
  held: HeldAnchors,
): Endpoint {
  const el = pinnedBoxedElement(ep, index);
  if (!el || ep.kind !== 'pinned') return ep;
  const centre = centreOf(el);
  const otherEl = pinnedBoxedElement(other, index);
  const aim = otherEl ? anchorAimPoint(otherEl, centre) : endpointPosition(other, index);
  const side = exitSideTowards(el, aim);
  const tag = `[arrow-rebind] trigger arrow=${arrowId} end=${end} element=${el.id}`;
  if (!side) {
    console.debug(`${tag} side=none ${ep.anchor}->${ep.anchor} kept=no-side`);
    return ep;
  }
  if (anchorLiesOn(ep.anchor, side)) {
    console.debug(`${tag} side=${side} ${ep.anchor}->${ep.anchor} kept=facing`);
    return ep;
  }
  const reference = otherEl ? centreOf(otherEl) : aim;
  const candidates = anchorsOf(side, anchorClass(ep.anchor));
  const anchor = pickCandidate(el, ep.anchor, candidates, reference, held);
  moveHeld(held, el.id, ep.anchor, anchor);
  console.debug(`${tag} side=${side} ${ep.anchor}->${anchor}`);
  return { kind: 'pinned', elementId: el.id, anchor };
}

// The trigger, then the re-evaluation of both pinned ends.
function reevaluate(arrow: ArrowElement, index: ElementIndex, held: HeldAnchors): ArrowElement {
  const path = arrowPolyline(arrow, index);
  const triggered = [arrow.from, arrow.to].some((ep) => {
    const el = pinnedBoxedElement(ep, index);
    return el !== null && pathPassesThrough(path, el);
  });
  if (!triggered) return arrow;
  const from = reanchorEnd(arrow.id, 'from', arrow.from, arrow.to, index, held);
  const to = reanchorEnd(arrow.id, 'to', arrow.to, arrow.from, index, held);
  if (from === arrow.from && to === arrow.to) return arrow;
  return { ...arrow, from, to };
}

export function rebindArrowAnchorsAfterMove(
  elements: Element[],
  movingIds: ReadonlySet<ElementId> | Map<ElementId, unknown>,
): Element[] {
  const moving = (id: ElementId) => movingIds.has(id);
  const considered: ElementId[] = [];
  for (const el of elements) {
    if (el.type === 'arrow' && isConsidered(el, moving)) considered.push(el.id);
  }
  if (considered.length === 0) return elements;

  const index = buildElementIndex(elements);
  const held = countHeld(elements);
  const changed = new Map<ElementId, ArrowElement>();
  for (const id of considered) {
    const arrow = index.get(id) as ArrowElement;
    const next = reevaluate(arrow, index, held);
    if (next === arrow) continue;
    index.set(id, next);
    changed.set(id, next);
  }
  swapCrossingEnds(elements, new Set(considered), index, changed);
  if (changed.size === 0) return elements;
  return elements.map((el) => changed.get(el.id) ?? el);
}

// True when either of the arrow's endpoints is attached to one of the given
// element ids — pinned to a box, or connected to another arrow's line
// (docs/specs/008-canvas/arrow-to-arrow.md). Used by the deletion / cascading-update paths (the editor's
// delete-selected, the eraser, and layer deletion, docs/specs/006-diagram/layers.md) so arrows
// attached to a removed box (or a removed arrow) are cleaned up alongside it.
export function arrowReferencesAny(arrow: ArrowElement, ids: ReadonlySet<string>): boolean {
  return (
    (arrow.from.kind === 'pinned' && ids.has(arrow.from.elementId)) ||
    (arrow.to.kind === 'pinned' && ids.has(arrow.to.elementId)) ||
    (arrow.from.kind === 'on-arrow' && ids.has(arrow.from.arrowId)) ||
    (arrow.to.kind === 'on-arrow' && ids.has(arrow.to.arrowId))
  );
}
