// Selection duplication (docs/specs/008-canvas/canvas-and-palette.md + docs/specs/008-canvas/arrow-to-arrow.md arrow-to-arrow): copy a set
// of elements with fresh ids, and arrows re-pinned to the copies. Split from
// factories.ts so that file stays purely the per-element creation
// factories; re-exported from ./index so the public surface is
// unchanged.

import {
  isBoxed,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type ElementId,
} from './index';

// What a COPY regenerates rather than inherits. EVERY copy path must spread this: the set duplication below, and
// the editor's hand-rolled single / multi duplicate paths.
//
// What belongs to the original rather than to the shape, so no copy carries it: a comment thread is a conversation
// about that element, and an assigned action is work handed to a person under its own id (docs/specs/012-collaboration/assigned-actions.md
// "A copy doesn't carry the action"): a duplicate under the same id is a second action nobody assigned, which the
// timeline never sees added. A Sheet's cell threads go the same way.
// The clipboard strips the same list on the way out (stripIdentity in apps/editor).
export const ORIGINAL_ONLY_FIELDS = ['commentThread', 'action'] as const;

export function freshCopyFields(el: Element): {
  rotation?: number;
  commentThread?: undefined;
  action?: undefined;
} {
  const fresh: { [K in (typeof ORIGINAL_ONLY_FIELDS)[number]]?: undefined } = {};
  for (const field of ORIGINAL_ONLY_FIELDS) if (field in el) fresh[field] = undefined;
  return fresh;
}

// Duplicate every element whose id is in `ids`:
// - Boxed elements get fresh ids and a position offset of (dx, dy).
// - Arrows whose both endpoints are pinned to ids inside the set get fresh
//   ids with endpoints remapped to the duplicates.
//
// Returns the new elements plus a map of old → new ids so callers can wire
// extra arrows (e.g. a connector from the original to the duplicate).
//
// `existing` is what an uncopied end may stay pinned to: the ids already on the
// tab the copies land on. It defaults to every id in `elements`, which is that
// tab for a duplicate; a paste passes the tab's own ids, because the clipboard
// elements it merges in are not on the tab (an arrow hung off a copied arrow
// that was dropped kept naming it, and was drawn at the canvas origin).
export function duplicateElements(
  elements: Element[],
  ids: ReadonlySet<ElementId>,
  dx: number,
  dy: number,
  existing?: ReadonlySet<ElementId>,
): { newElements: Element[]; idMap: Map<ElementId, ElementId> } {
  const idMap = new Map<ElementId, ElementId>();
  const newBoxed: BoxedElement[] = [];

  for (const el of elements) {
    if (!ids.has(el.id) || !isBoxed(el)) continue;
    const newId = crypto.randomUUID();
    idMap.set(el.id, newId);
    const copy = { ...el, id: newId, x: el.x + dx, y: el.y + dy, ...freshCopyFields(el) };
    newBoxed.push(copy);
  }

  const existingIds = existing ?? new Set(elements.map((e) => e.id));

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
    if (dup) return { kind: 'pinned', elementId: dup, anchor: end.anchor };
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
  // they need the finished idMap.
  //
  // A reference to something OUTSIDE the copied set is left alone. Only
  // references whose target was itself copied follow the copy.
  const rewired = newBoxed.map((el) => {
    let next = { ...el };
    if (next.type === 'shape') {
      const shape = { ...next };
      // An attached badge or step (docs/specs/009-elements/badge.md) follows its host's copy; copied alone it lands
      // detached.
      if (shape.attachedTo !== undefined) {
        const host = idMap.get(shape.attachedTo);
        if (host !== undefined) shape.attachedTo = host;
        else {
          delete shape.attachedTo;
          delete shape.attachAt;
        }
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
// hung off another arrow (docs/specs/008-canvas/arrow-to-arrow.md), and an attached badge's, step number's or
// pointer note's host (docs/specs/009-elements/badge.md). A reference whose target isn't in the map is
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
    // An attached chip follows its host's new id; missed, a duplicated tab's badges named hosts on the SOURCE tab
    // and came loose from their copies.
    const attachedTo = 'attachedTo' in el ? el.attachedTo : undefined;
    const host = attachedTo !== undefined ? idMap.get(attachedTo) : undefined;
    return host ? { ...el, attachedTo: host } : el;
  });
}

// Re-point tab and element links after a whole document is copied with fresh
// tab ids (old → new in `tabIdMap`), so the copy's internal navigation lands
// on its own tabs instead of the source document's. A Tab Window's tab
// (`windowTabId`, docs/specs/009-elements/tab-window.md) is re-pointed the same way, so the copy's windows show the
// copy's tabs rather than "This tab isn't available". Document and url links
// leave the document, so they survive unchanged. Shared by the editor's
// Explorer duplicate and the api's copy route, which drifted apart when each
// owned a copy of this walk: the api's copies kept pointing at the source.
export function remapTabLinks<E extends Element>(
  elements: E[],
  tabIdMap: Map<string, string>,
): E[] {
  return elements.map((el) => {
    const link = el.link;
    const linked =
      link && (link.kind === 'tab' || link.kind === 'element')
        ? tabIdMap.get(link.tabId)
        : undefined;
    const windowTabId = (el as { windowTabId?: string }).windowTabId;
    const shown = windowTabId ? tabIdMap.get(windowTabId) : undefined;
    if (!linked && !shown) return el;
    return {
      ...el,
      ...(linked ? { link: { ...link!, tabId: linked } } : {}),
      ...(shown ? { windowTabId: shown } : {}),
    };
  });
}
