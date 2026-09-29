import { isBoxed, type Anchor, type ArrowElement, type Element, type ElementId } from './index';
import { anchorLiesOn, type Side } from './anchors';
import { arrowPolyline, passesThroughOwnShapes, pathsCross } from './arrow-path-hits';

// SAME-SIDE CROSSING SWAP (docs/specs/008-canvas/arrow-anchors.md
// "Crossings on one side"): two pinned ends on one side of one shape whose
// drawn paths cross trade anchors, provided the trade uncrosses them and
// sends neither path through a shape of its own ends. No side changes.
// Runs after the auto-rebind's re-evaluation, on the same working index.

// Uncrossing straight paths converges in a pass or two; curves are capped.
export const SWAP_MAX_PASSES = 8;
// A side busier than this is left alone: pairs grow quadratically and a fan
// that dense is separated visually anyway.
export const SWAP_MAX_ENDS_PER_SIDE = 32;

const SIDES: readonly Side[] = ['n', 'e', 's', 'w'];

type End = { arrowId: ElementId; end: 'from' | 'to' };

const anchorOf = (index: Map<ElementId, Element>, e: End): Anchor | null => {
  const ep = (index.get(e.arrowId) as ArrowElement)[e.end];
  return ep.kind === 'pinned' ? ep.anchor : null;
};

const withAnchor = (arrow: ArrowElement, end: 'from' | 'to', anchor: Anchor): ArrowElement => {
  const ep = arrow[end];
  if (ep.kind !== 'pinned') return arrow;
  return { ...arrow, [end]: { kind: 'pinned', elementId: ep.elementId, anchor } };
};

// Pinned ends grouped by element, arrows in document order, `from` first.
// Self-loops take no part.
function endsByElement(elements: Element[]): Map<ElementId, End[]> {
  const groups = new Map<ElementId, End[]>();
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    if (
      el.from.kind === 'pinned' &&
      el.to.kind === 'pinned' &&
      el.from.elementId === el.to.elementId
    ) {
      continue;
    }
    for (const end of ['from', 'to'] as const) {
      const ep = el[end];
      if (ep.kind !== 'pinned') continue;
      const list = groups.get(ep.elementId);
      if (list) list.push({ arrowId: el.id, end });
      else groups.set(ep.elementId, [{ arrowId: el.id, end }]);
    }
  }
  return groups;
}

// Try trading the anchors of two ends; returns true when the trade applied.
function trySwap(
  elementId: ElementId,
  a: End,
  b: End,
  considered: ReadonlySet<ElementId>,
  index: Map<ElementId, Element>,
  changed: Map<ElementId, ArrowElement>,
): boolean {
  if (a.arrowId === b.arrowId) return false;
  if (!considered.has(a.arrowId) && !considered.has(b.arrowId)) return false;
  const anchorA = anchorOf(index, a);
  const anchorB = anchorOf(index, b);
  if (!anchorA || !anchorB || anchorA === anchorB) return false;
  const arrowA = index.get(a.arrowId) as ArrowElement;
  const arrowB = index.get(b.arrowId) as ArrowElement;
  if (!pathsCross(arrowPolyline(arrowA, index), arrowPolyline(arrowB, index))) return false;
  const tradedA = withAnchor(arrowA, a.end, anchorB);
  const tradedB = withAnchor(arrowB, b.end, anchorA);
  const pathA = arrowPolyline(tradedA, index);
  const pathB = arrowPolyline(tradedB, index);
  if (pathsCross(pathA, pathB)) return false;
  if (passesThroughOwnShapes(tradedA, pathA, index)) return false;
  if (passesThroughOwnShapes(tradedB, pathB, index)) return false;
  index.set(tradedA.id, tradedA);
  index.set(tradedB.id, tradedB);
  changed.set(tradedA.id, tradedA);
  changed.set(tradedB.id, tradedB);
  console.debug(
    `[arrow-rebind] swap element=${elementId} arrows=${a.arrowId},${b.arrowId} ${anchorA}<->${anchorB}`,
  );
  return true;
}

export function swapCrossingEnds(
  elements: Element[],
  considered: ReadonlySet<ElementId>,
  index: Map<ElementId, Element>,
  changed: Map<ElementId, ArrowElement>,
): void {
  const groups = endsByElement(elements);
  for (const host of elements) {
    const ends = groups.get(host.id);
    if (!ends || !isBoxed(host) || !ends.some((e) => considered.has(e.arrowId))) continue;
    for (const side of SIDES) {
      // A trade keeps the set of anchors on the side, so membership is fixed.
      const onSide = ends.filter((e) => {
        const anchor = anchorOf(index, e);
        return anchor !== null && anchorLiesOn(anchor, side);
      });
      if (onSide.length < 2) continue;
      if (onSide.length > SWAP_MAX_ENDS_PER_SIDE) {
        console.debug(
          `[arrow-rebind] swap skipped element=${host.id} side=${side} ends=${onSide.length}`,
        );
        continue;
      }
      for (let pass = 0; pass < SWAP_MAX_PASSES; pass++) {
        let swapped = false;
        for (let i = 0; i < onSide.length; i++) {
          for (let j = i + 1; j < onSide.length; j++) {
            if (trySwap(host.id, onSide[i]!, onSide[j]!, considered, index, changed)) {
              swapped = true;
            }
          }
        }
        if (!swapped) break;
      }
    }
  }
}
