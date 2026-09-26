// Selection duplication (docs/specs/008-canvas/canvas-and-palette.md + docs/specs/008-canvas/arrow-to-arrow.md arrow-to-arrow): copy a set
// of elements with fresh ids, and arrows re-pinned to the copies. Split from
// factories.ts so that file stays purely the per-element creation
// factories; re-exported from ./index so the public surface is
// unchanged.

import {
  eventStormingTilt,
  isBoxed,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type ElementId,
} from './index';

// What a COPY regenerates rather than inherits. Today: an event-storming
// note's hand-placement (docs/specs/021-event-storming/event-storming.md) — a duplicate is a new piece of paper, so
// carrying the source's exact angle made it read as a photocopy, the one
// thing a real wall never shows. Scoped to the fixed-size sticky (the ES
// stamp) so a deliberately-rotated element anywhere else keeps its angle.
//
// EVERY copy path must spread this: the set duplication below, and the
// editor's hand-rolled single / multi duplicate paths. It exists precisely
// because "the one place copies happen" turned out to be three places.
export function freshCopyFields(el: Element): { rotation?: number } {
  if (el.type === 'sticky' && el.fixedSize) return { rotation: eventStormingTilt() };
  return {};
}

// Duplicate every element whose id is in `ids`:
// - Boxed elements get fresh ids and a position offset of (dx, dy).
// - Arrows whose both endpoints are pinned to ids inside the set get fresh
//   ids with endpoints remapped to the duplicates.
//
// Returns the new elements plus a map of old → new ids so callers can wire
// extra arrows (e.g. a connector from the original to the duplicate).
export function duplicateElements(
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
    newBoxed.push({
      ...el,
      id: newId,
      x: el.x + dx,
      y: el.y + dy,
      ...freshCopyFields(el),
    });
  }

  const existingIds = new Set(elements.map((e) => e.id));

  // Decide which arrows copy, and mint their new ids into idMap BEFORE
  // building any copy: an on-arrow endpoint (docs/specs/008-canvas/arrow-to-arrow.md) can only follow
  // its target's duplicate if that duplicate's id is already known when
  // the endpoint is remapped. (Minting inline at push time left idMap
  // arrow-less, so every copied arrow-on-arrow connection stayed pinned
  // to the ORIGINAL arrow — or, cross-tab, to a dangling id.)
  // An arrow copies when it's explicitly in the duplicated set, OR when
  // both endpoints pin to elements that were duplicated — so a connector
  // between two copied elements rides along even if the marquee didn't
  // catch the arrow itself.
  let arrowsToCopy: ArrowElement[] = [];
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    const bothEndsDuplicated =
      el.from.kind === 'pinned' &&
      el.to.kind === 'pinned' &&
      idMap.has(el.from.elementId) &&
      idMap.has(el.to.elementId);
    if (!ids.has(el.id) && !bothEndsDuplicated) continue;
    idMap.set(el.id, crypto.randomUUID());
    arrowsToCopy.push(el);
  }

  // Settle droppability to a FIXPOINT before building any copy: an arrow
  // whose endpoint can't resolve (its pin target neither copies nor
  // exists) is dropped, and dropping it can strand another copied
  // arrow's on-arrow endpoint (docs/specs/008-canvas/arrow-to-arrow.md) that had already resolved to its
  // duplicate — which would commit an endpoint pointing at an arrow that
  // never gets created (rendered at the canvas origin, then persisted).
  // Repeat until no arrow drops, so every surviving remap is final.
  const endpointResolvable = (end: ArrowElement['from']): boolean => {
    if (end.kind === 'free') return true;
    if (end.kind === 'on-arrow') return idMap.has(end.arrowId) || existingIds.has(end.arrowId);
    return idMap.has(end.elementId) || existingIds.has(end.elementId);
  };
  for (;;) {
    const surviving = arrowsToCopy.filter(
      (el) => endpointResolvable(el.from) && endpointResolvable(el.to),
    );
    if (surviving.length === arrowsToCopy.length) break;
    for (const el of arrowsToCopy) {
      if (!surviving.includes(el)) idMap.delete(el.id);
    }
    arrowsToCopy = surviving;
  }

  // Re-point one endpoint of a duplicated arrow: a FREE end translates by
  // (dx, dy) so a free-floating arrow copies in place like any boxed
  // element; a PINNED end follows its duplicate when the target was
  // copied, otherwise keeps the original pin (still a real element, so no
  // orphan). A pin to an element that's gone entirely (e.g. a cross-tab
  // paste where the target wasn't carried over) returns null and the
  // whole arrow is skipped rather than left dangling.
  const remapEndpoint = (end: ArrowElement['from']): ArrowElement['from'] | null => {
    if (end.kind === 'free') return { kind: 'free', x: end.x + dx, y: end.y + dy };
    // Connected to another arrow's line (docs/specs/008-canvas/arrow-to-arrow.md): follow the duplicate when
    // the target arrow was copied too, else keep the original, else drop.
    if (end.kind === 'on-arrow') {
      const dupArrow = idMap.get(end.arrowId);
      if (dupArrow) return { kind: 'on-arrow', arrowId: dupArrow, t: end.t };
      return existingIds.has(end.arrowId) ? end : null;
    }
    const dup = idMap.get(end.elementId);
    // Preserve `manual`: a hand-placed anchor must stay fixed on the
    // copy too, or the auto-rebind re-chooses the face on first move.
    if (dup) {
      return {
        kind: 'pinned',
        elementId: dup,
        anchor: end.anchor,
        ...(end.manual ? { manual: true } : {}),
      };
    }
    return existingIds.has(end.elementId) ? end : null;
  };

  const newArrows: ArrowElement[] = [];
  for (const el of arrowsToCopy) {
    const from = remapEndpoint(el.from);
    const to = remapEndpoint(el.to);
    // A dropped arrow must leave idMap too — callers use the map to
    // select / wire the duplicates, and a phantom id would dangle.
    if (!from || !to) {
      idMap.delete(el.id);
      continue;
    }
    // Spread the source so styling (stroke, ends, dash, arrowhead, curve,
    // label) survives the copy; only the id + endpoints are replaced.
    newArrows.push({ ...el, id: idMap.get(el.id)!, from, to });
  }

  // Element-to-element references on the BOXED copies, rewired last because
  // they need the finished idMap (a mind child and its parent are both in it,
  // and a portal's partner may be an arrow's id).
  //
  // These were missed for a long time, and the failure was quiet in the way
  // duplicate bugs usually are: the copy looked right and behaved wrong.
  // Duplicating a mind-map subtree gave you nodes whose `mindParentId` still
  // named the ORIGINAL parent, so the copy re-parented itself onto the tree it
  // came from; duplicating a linked pair of portals gave you two portals that
  // both stepped through to the originals. Paste made it worse, because a
  // cross-tab paste points those ids at elements that are not in the tab at
  // all.
  //
  // A reference to something OUTSIDE the copied set is left alone: copying one
  // child of a mind map and pasting it back should still hang off that parent.
  // Only references whose target was itself copied follow the copy.
  const rewired = newBoxed.map((el) => {
    let next = { ...el };
    // mindParentId (docs/specs/009-elements/mind-node.md) and portalTarget (docs/specs/009-elements/portal-element.md) live on the shape
    // element only, so narrow before reaching for them.
    if (next.type === 'shape') {
      const shape = { ...next };
      if (shape.mindParentId !== undefined) {
        const mapped = idMap.get(shape.mindParentId);
        if (mapped !== undefined) shape.mindParentId = mapped;
      }
      if (shape.portalTarget !== undefined) {
        const mapped = idMap.get(shape.portalTarget);
        if (mapped !== undefined) shape.portalTarget = mapped;
      }
      next = shape;
    }
    // An element link pointing AT a copied element follows the copy too. The
    // tab id is deliberately untouched: a link is to an element on a named
    // tab, and duplicating within that tab does not change which tab it is.
    if (next.link?.kind === 'element') {
      const mapped = idMap.get(next.link.elementId);
      if (mapped !== undefined) next = { ...next, link: { ...next.link, elementId: mapped } };
    }
    return next;
  });

  return { newElements: [...rewired, ...newArrows], idMap };
}

// Re-point element-to-element references after a caller has renamed some
// element ids (old → new in `idMap`): arrow endpoints pinned to an element or
// hung off another arrow (docs/specs/008-canvas/arrow-to-arrow.md), a mind-map node's parent (docs/specs/009-elements/mind-node.md) and a
// portal's partner (docs/specs/009-elements/portal-element.md). A reference whose target isn't in the map is
// left alone. Element links are deliberately NOT touched: a link names its
// tab as well as its element, and that is still the source tab.
//
// This is the reference half of every "same elements, fresh ids" path
// (import re-mint, AI merge). Each of those used to re-list the reference
// kinds itself, and each one that forgot a kind left the copy wired to the
// original. duplicateElements has its own richer pass (offsets, dropping
// unresolvable arrows) and stays separate.
export function remapElementRefs<E extends Element>(
  elements: E[],
  idMap: Map<ElementId, ElementId>,
): E[] {
  if (idMap.size === 0) return elements;
  const endpoint = (end: ArrowElement['from']): ArrowElement['from'] => {
    if (end.kind === 'pinned') {
      const mapped = idMap.get(end.elementId);
      return mapped ? { ...end, elementId: mapped } : end;
    }
    if (end.kind === 'on-arrow') {
      const mapped = idMap.get(end.arrowId);
      return mapped ? { ...end, arrowId: mapped } : end;
    }
    return end;
  };
  return elements.map((el) => {
    if (el.type === 'arrow') {
      const from = endpoint(el.from);
      const to = endpoint(el.to);
      return from === el.from && to === el.to ? el : { ...el, from, to };
    }
    if (el.type !== 'shape') return el;
    const parent = el.mindParentId !== undefined ? idMap.get(el.mindParentId) : undefined;
    const portal = el.portalTarget !== undefined ? idMap.get(el.portalTarget) : undefined;
    if (!parent && !portal) return el;
    return {
      ...el,
      ...(parent ? { mindParentId: parent } : {}),
      ...(portal ? { portalTarget: portal } : {}),
    };
  });
}

// Re-point tab and element links after a whole diagram is copied with fresh
// tab ids (old → new in `tabIdMap`), so the copy's internal navigation lands
// on its own tabs instead of the source diagram's. Diagram and url links
// leave the diagram, so they survive unchanged. Shared by the editor's
// Explorer duplicate and the api's copy route, which drifted apart when each
// owned a copy of this walk: the api's copies kept pointing at the source.
export function remapTabLinks<E extends Element>(
  elements: E[],
  tabIdMap: Map<string, string>,
): E[] {
  return elements.map((el) => {
    const link = el.link;
    if (!link || (link.kind !== 'tab' && link.kind !== 'element')) return el;
    const next = tabIdMap.get(link.tabId);
    return next ? { ...el, link: { ...link, tabId: next } } : el;
  });
}
