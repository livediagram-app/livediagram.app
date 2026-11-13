// Every arrow's frame and route-behind holes for an element layer, carried over from the last board for the arrows a
// change cannot reach (each editor's docs/specs/008-canvas/canvas-performance.md "A drop redraws what it reached"). A
// drop or a stroke changes one element or two, and deriving every arrow on the board again was a tenth of the commit.
//
// What an arrow's geometry reads (arrow-endpoint-spread.ts, arrow-behind.ts):
// - the elements its ends are pinned to, and the arrows they ride on;
// - each fan its ends join: the fan's box, the fan's arrows, and the box at each of their other ends (one hop: a fan
//   reads the other ends where they are pinned, never where their own fans put them);
// - the boxes inside its route-behind query rect (the holes).
// So a changed box reaches the arrows pinned to it, the arrows sharing a pin with the other end of one of those, and
// the arrows whose query rect it is in, where it was or where it went. A changed, new or gone arrow (a drop re-pins
// the arrows of the box it moved) reaches itself and every arrow at its pins, where it was and is (their fans' members
// change). Everything else is carried over as it was (the same object, so a view comparing by value has nothing to
// compare). The whole board is derived afresh for an element whose extent is unknown or a new key (the finish), and the
// arrows whose geometry reads more than their neighbours (one a finish may route through its mind map, one at a fan
// with an end on an arrow) always are.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import type { DragArrowEnd } from './drag-affected-arrows';

type Identified = { readonly id: string; readonly type: string };

export type ArrowGeometryModel<E extends Identified, G> = {
  isArrow: (el: E) => boolean;
  ends: (arrow: E) => readonly [DragArrowEnd, DragArrowEnd];
  /** Where a box changing changes this geometry's holes: its route-behind query rect. */
  reach: (geometry: G) => Rect;
  /** Whether a finish may route the arrow from the shape of the map round it (a mind map's connectors), reading
   *  more than its neighbours: such an arrow is always derived afresh. */
  structural: (arrow: E) => boolean;
};

const extentOf = (el: Identified): Rect | null => {
  const r = el as unknown as Partial<Rect>;
  return typeof r.x === 'number' &&
    typeof r.y === 'number' &&
    typeof r.width === 'number' &&
    typeof r.height === 'number'
    ? { x: r.x, y: r.y, width: r.width, height: r.height }
    : null;
};

const meets = (a: Rect, b: Rect) =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

const pinnedId = (end: DragArrowEnd) =>
  end.kind === 'pinned' ? (end as { elementId: string }).elementId : null;

type Board<E, G> = { byId: Map<string, E>; out: Map<string, G>; key: unknown };

export type ArrowGeometryCache<E, G> = {
  /** Every arrow's geometry on `elements` (`compute` derives one from the board as it is now), reusing the last
   *  board's where no change reaches it. The map returned is the one the next call carries over from, so a caller
   *  that draws an entry again for a reason of its own (a page's fill under it) sets it there. */
  geometryFor: (elements: readonly E[], key: unknown, compute: (arrow: E) => G) => Map<string, G>;
};

export function createArrowGeometryCache<E extends Identified, G>(
  model: ArrowGeometryModel<E, G>,
): ArrowGeometryCache<E, G> {
  let last: Board<E, G> | null = null;

  const full = (elements: readonly E[], compute: (arrow: E) => G) => {
    const out = new Map<string, G>();
    for (const el of elements) if (model.isArrow(el)) out.set(el.id, compute(el));
    return out;
  };

  // The arrows a change to `dirty` (non-arrow ids, with where they were and are) reaches, or null when it cannot be
  // told and every arrow is derived afresh.
  const reached = (
    elements: readonly E[],
    prev: Board<E, G>,
    dirty: Set<string>,
    rects: Rect[],
    arrowsChanged: Set<string>,
    arrowPins: Set<string>,
  ): Set<string> => {
    const arrows = elements.filter(model.isArrow);
    // Pins whose fan reads an arrow (an end on an arrow): placed again on any change, so each arrow there is too.
    const volatilePins = new Set<string>();
    const rides = (a: E) => model.ends(a).some((e) => e.kind === 'on-arrow');
    for (const a of arrows)
      if (rides(a))
        for (const e of model.ends(a)) {
          const id = pinnedId(e);
          if (id) volatilePins.add(id);
        }
    // The pins at the other end of each arrow pinned to a changed box: their fans read that box.
    const hubs = new Set(dirty);
    for (const a of arrows) {
      const [from, to] = model.ends(a).map(pinnedId);
      if (from && dirty.has(from) && to) hubs.add(to);
      if (to && dirty.has(to) && from) hubs.add(from);
    }
    const out = new Set<string>();
    for (const a of arrows) {
      const was = prev.out.get(a.id);
      const ends = model.ends(a).map(pinnedId);
      if (
        was === undefined ||
        arrowsChanged.has(a.id) ||
        rides(a) ||
        model.structural(a) ||
        ends.some(
          (id) => id !== null && (hubs.has(id) || volatilePins.has(id) || arrowPins.has(id)),
        ) ||
        rects.some((r) => meets(r, model.reach(was)))
      )
        out.add(a.id);
    }
    return out;
  };

  return {
    geometryFor(elements, key, compute) {
      const byId = new Map<string, E>();
      for (const el of elements) byId.set(el.id, el);
      const prev = last;
      let out: Map<string, G> | null = null;
      if (prev && prev.key === key) {
        // What changed since the last board: ids new, gone or not the same object.
        const dirty = new Set<string>();
        const rects: Rect[] = [];
        const arrowsChanged = new Set<string>();
        const arrowPins = new Set<string>();
        let known = true;
        const note = (el: E) => {
          if (model.isArrow(el)) {
            arrowsChanged.add(el.id);
            for (const end of model.ends(el)) {
              const id = pinnedId(end);
              if (id) arrowPins.add(id);
            }
            return true;
          }
          const r = extentOf(el);
          if (!r) return (known = false);
          rects.push(r);
          dirty.add(el.id);
          return true;
        };
        for (const el of elements) {
          const was = prev.byId.get(el.id);
          if (was === el) continue;
          if (!note(el) || (was && !note(was))) break;
        }
        if (known) for (const [id, was] of prev.byId) if (!byId.has(id) && !note(was)) break;
        if (known) {
          const redo = reached(elements, prev, dirty, rects, arrowsChanged, arrowPins);
          out = new Map();
          for (const el of elements) {
            if (!model.isArrow(el)) continue;
            out.set(el.id, redo.has(el.id) ? compute(el) : prev.out.get(el.id)!);
          }
        }
      }
      out ??= full(elements, compute);
      last = { byId, out, key };
      return out;
    },
  };
}
