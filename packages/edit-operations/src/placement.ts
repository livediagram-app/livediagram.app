// Where `add` and `move` put an element (docs/specs/024-agents/edit-operations.md "Placement";
// blueprint "Placement", EO23 to EO27, EO50): beside, after, inside or aligned with a reference, at a
// point from the content origin, or, for a new element, beside the last one added. Side, `after` and
// default spots move along their axis past whatever already sits there; `at:` and `align:` are exact.

import type { EditRejection } from '@livediagram/api-schema';
import {
  FRAME_PAD,
  FRAME_TOP,
  isContainer,
  type Element,
  type ElementId,
} from '@livediagram/document';
import { resolveOne } from './selectors';
import { currentElements, refsOf, type EditState } from './state';
import type { Placement } from './types';
import { PLACEMENT_GAP } from './vocabulary';

export type Box = { x: number; y: number; width: number; height: number };
type Side = 'right-of' | 'left-of' | 'above' | 'below';

export type Placed = {
  x: number;
  y: number;
  // The element placed against, whose layer a new element takes.
  ref?: Element;
  // A container `inside:` had to grow to hold the element (EO27).
  grow?: { container: Element; height: number };
};

export const boxOf = (el: Element): Box | null =>
  el.type === 'arrow' ? null : { x: el.x, y: el.y, width: el.width, height: el.height };

const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// What a placed box must not land on: boxed elements other than containers and the moving set.
function occupiers(state: EditState, moving: ReadonlySet<ElementId>): Box[] {
  return currentElements(state).flatMap((el) => {
    const box = boxOf(el);
    return box && !isContainer(el) && !moving.has(el.id) ? [box] : [];
  });
}

// Moves `box` along `side` past each occupier it overlaps, one at a time: each step passes one
// occupier, so the walk ends.
export function nudgeUntilFree(box: Box, side: Side, gap: number, taken: readonly Box[]): Box {
  let at = box;
  for (let step = 0; step <= taken.length; step++) {
    const hit = taken.find((other) => overlaps(at, other));
    if (!hit) return at;
    at =
      side === 'right-of'
        ? { ...at, x: hit.x + hit.width + gap }
        : side === 'left-of'
          ? { ...at, x: hit.x - gap - at.width }
          : side === 'below'
            ? { ...at, y: hit.y + hit.height + gap }
            : { ...at, y: hit.y - gap - at.height };
  }
  return at;
}

function beside(ref: Box, side: Side, size: { width: number; height: number }, gap: number): Box {
  const c = centre(ref);
  switch (side) {
    case 'right-of':
      return {
        x: ref.x + ref.width + gap,
        y: c.y - size.height / 2,
        width: size.width,
        height: size.height,
      };
    case 'left-of':
      return {
        x: ref.x - gap - size.width,
        y: c.y - size.height / 2,
        width: size.width,
        height: size.height,
      };
    case 'below':
      return {
        x: c.x - size.width / 2,
        y: ref.y + ref.height + gap,
        width: size.width,
        height: size.height,
      };
    case 'above':
      return {
        x: c.x - size.width / 2,
        y: ref.y - gap - size.height,
        width: size.width,
        height: size.height,
      };
  }
}

// `after:x`: the side the flow of x's outgoing arrows points to, `below` without any (EO24).
function sideAfter(state: EditState, ref: Element, refBox: Box): Side {
  const from = centre(refBox);
  const targets = currentElements(state).flatMap((el) => {
    if (el.type !== 'arrow' || el.from.kind !== 'pinned' || el.from.elementId !== ref.id) return [];
    if (el.to.kind !== 'pinned') return [];
    const target = state.byId.get(el.to.elementId);
    const box = target && boxOf(target);
    return box ? [centre(box)] : [];
  });
  if (targets.length === 0) return 'below';
  const dx = targets.reduce((sum, t) => sum + t.x - from.x, 0);
  const dy = targets.reduce((sum, t) => sum + t.y - from.y, 0);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right-of' : 'left-of';
  return dy >= 0 ? 'below' : 'above';
}

// `inside:frame`: the first free slot of the interior, in rows top to bottom and left to right in
// steps of the gap; none free: below the lowest member, the container growing to hold it (EO27).
function insideSlot(
  container: Box,
  size: { width: number; height: number },
  taken: readonly Box[],
  gap: number,
) {
  const left = container.x + FRAME_PAD;
  const right = container.x + container.width - FRAME_PAD;
  const top = container.y + FRAME_TOP;
  const bottom = container.y + container.height - FRAME_PAD;
  const inside = taken.filter((b) => overlaps(b, container));
  for (let y = top; y + size.height <= bottom; y += gap) {
    for (let x = left; x + size.width <= right; x += gap) {
      const box = { x, y, width: size.width, height: size.height };
      if (!inside.some((b) => overlaps(box, b))) return { box };
    }
  }
  const lowest = inside.reduce((max, b) => Math.max(max, b.y + b.height), top - gap);
  const y = lowest + gap;
  return {
    box: { x: left, y, width: size.width, height: size.height },
    height: y + size.height + FRAME_PAD - container.y,
  };
}

// `align:x` on the axis where `box`'s centre is already nearer x's; the column on a tie (EO50).
function aligned(box: Box, ref: Box): Box {
  const [c, r] = [centre(box), centre(ref)];
  return Math.abs(c.x - r.x) <= Math.abs(c.y - r.y)
    ? { ...box, x: r.x - box.width / 2 }
    : { ...box, y: r.y - box.height / 2 };
}

// The spot for a new element without a placement: right of the one this changeset added last, else
// right of all boxed content at its top, else the origin (EO26).
export function defaultSpot(
  state: EditState,
  size: { width: number; height: number },
  moving: ReadonlySet<ElementId>,
): Box {
  const taken = occupiers(state, moving);
  const last = [...state.created]
    .reverse()
    .map((id) => state.byId.get(id))
    .find((el) => el && boxOf(el));
  if (last)
    return nudgeUntilFree(
      beside(boxOf(last)!, 'right-of', size, PLACEMENT_GAP),
      'right-of',
      PLACEMENT_GAP,
      taken,
    );
  const boxes = currentElements(state).flatMap((el) =>
    boxOf(el) && !moving.has(el.id) ? [boxOf(el)!] : [],
  );
  if (boxes.length === 0)
    return { x: state.origin.x, y: state.origin.y, width: size.width, height: size.height };
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const top = Math.min(...boxes.map((b) => b.y));
  return nudgeUntilFree(
    { x: right + PLACEMENT_GAP, y: top, width: size.width, height: size.height },
    'right-of',
    PLACEMENT_GAP,
    taken,
  );
}

// Where `placement` puts a box of `size`, `moving` being what moves with it (nothing to land on, and
// never a reference).
export function resolvePlacement(
  state: EditState,
  placement: Placement | undefined,
  size: { width: number; height: number },
  moving: ReadonlySet<ElementId>,
  operation: number,
  start?: Box,
): Placed | { rejection: EditRejection } {
  if (placement === undefined) {
    const box = start ?? defaultSpot(state, size, moving);
    return { x: Math.round(box.x), y: Math.round(box.y) };
  }
  if (placement.rel === 'at')
    return { x: state.origin.x + placement.x, y: state.origin.y + placement.y };
  const resolved = resolveOne(state, placement.ref, operation);
  if ('rejection' in resolved) return resolved;
  const ref = resolved.el;
  const refBox = boxOf(ref);
  const refusal = (rule: string) => ({
    rejection: {
      code: 'invalid_value' as const,
      operation,
      details: [`${placement.rel}:${placement.ref}: ${refsOf(state).refOf(ref.id)} ${rule}`],
      hint: 'place against a box that is not moving',
    },
  });
  if (!refBox) return refusal('is an arrow; place against a box');
  if (moving.has(ref.id)) return refusal('moves with it');
  const gap = placement.gap ?? PLACEMENT_GAP;
  const taken = occupiers(state, moving);
  switch (placement.rel) {
    case 'inside': {
      if (!isContainer(ref)) return refusal('is not a frame or lane');
      const slot = insideSlot(refBox, size, taken, PLACEMENT_GAP);
      return {
        x: Math.round(slot.box.x),
        y: Math.round(slot.box.y),
        ref,
        ...(slot.height !== undefined
          ? { grow: { container: ref, height: Math.round(slot.height) } }
          : {}),
      };
    }
    case 'align': {
      const box = aligned(start ?? defaultSpot(state, size, moving), refBox);
      return { x: Math.round(box.x), y: Math.round(box.y), ref };
    }
    default: {
      const side = placement.rel === 'after' ? sideAfter(state, ref, refBox) : placement.rel;
      const box = nudgeUntilFree(beside(refBox, side, size, gap), side, gap, taken);
      return { x: Math.round(box.x), y: Math.round(box.y), ref };
    }
  }
}
