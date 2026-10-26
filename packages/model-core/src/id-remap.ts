// Re-pointing references after elements or tabs get fresh ids, for every product's model. This is the reference half
// of every "same elements, fresh ids" path (import re-mint, AI merge, a duplicated tab or file): each of those used to
// re-list the reference kinds itself, and each one that forgot a kind left the copy wired to the original. The walk
// is the same in every product; which fields hold an element id is the product's, so each binds its own list
// (its duplicate.ts). Reads nothing of a product's element union.

// An arrow end: pinned to an element, hung off another arrow, or free (anything else is left alone).
type End = { kind: string; elementId?: string; arrowId?: string };

function remapEnd<T extends End>(end: T, idMap: ReadonlyMap<string, string>): T {
  if (end.kind === 'pinned' && end.elementId !== undefined) {
    const mapped = idMap.get(end.elementId);
    return mapped ? { ...end, elementId: mapped } : end;
  }
  if (end.kind === 'on-arrow' && end.arrowId !== undefined) {
    const mapped = idMap.get(end.arrowId);
    return mapped ? { ...end, arrowId: mapped } : end;
  }
  return end;
}

// Re-point element-to-element references after a caller has renamed some element ids (old to new in `idMap`): an
// arrow's ends pinned to an element or hung off another arrow (docs/specs/008-canvas/arrow-to-arrow.md), and on any
// other element each of `refFields` that names an element (a mind node's parent, a portal's partner, an attached
// badge's host, ...). A reference whose target isn't in the map is left alone. Element links are deliberately NOT
// touched: a link names its tab as well as its element, and that is still the source tab.
export function remapElementRefs<E extends { type: string }>(
  elements: E[],
  idMap: ReadonlyMap<string, string>,
  refFields: readonly string[],
): E[] {
  if (idMap.size === 0) return elements;
  return elements.map((el) => {
    if (el.type === 'arrow') {
      const arrow = el as E & { from: End; to: End };
      const from = remapEnd(arrow.from, idMap);
      const to = remapEnd(arrow.to, idMap);
      return from === arrow.from && to === arrow.to ? el : { ...el, from, to };
    }
    let moved: Record<string, string> | null = null;
    for (const field of refFields) {
      const id = (el as Record<string, unknown>)[field];
      const mapped = typeof id === 'string' ? idMap.get(id) : undefined;
      if (mapped) (moved ??= {})[field] = mapped;
    }
    return moved ? { ...el, ...moved } : el;
  });
}

// Re-point tab and element links after a whole file is copied with fresh tab ids (old to new in `tabIdMap`), so the
// copy's internal navigation lands on its own tabs instead of the source's. A Tab Window's tab (`windowTabId`,
// docs/specs/009-elements/tab-window.md) is re-pointed the same way, so the copy's windows show the copy's tabs rather
// than "This tab isn't available". Links to another file or a url leave the file, so they survive unchanged. Shared
// by the editor's Explorer duplicate and the api's copy route, which drifted apart when each owned a copy of this
// walk: the api's copies kept pointing at the source.
export function remapTabLinks<E extends object>(
  elements: E[],
  tabIdMap: ReadonlyMap<string, string>,
): E[] {
  return elements.map((el) => {
    const { link, windowTabId } = el as {
      link?: { kind: string; tabId?: string };
      windowTabId?: string;
    };
    const linked =
      link && (link.kind === 'tab' || link.kind === 'element') && link.tabId !== undefined
        ? tabIdMap.get(link.tabId)
        : undefined;
    const shown = windowTabId ? tabIdMap.get(windowTabId) : undefined;
    if (!linked && !shown) return el;
    return {
      ...el,
      ...(linked ? { link: { ...link!, tabId: linked } } : {}),
      ...(shown ? { windowTabId: shown } : {}),
    };
  });
}
