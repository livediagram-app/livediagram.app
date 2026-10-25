'use client';

// Which sketched shapes are backdrops (docs/specs/008-canvas/finish.md "Sketch"): shapes other elements sit on,
// which keep a solid fill rather than hatching. Worked out once per tab by the elements layer
// (sketchBackdropIds in @liveplanner/project) and read per element, so a shape's view re-renders only when its
// own flag flips, never on every drag frame (docs/specs/008-canvas/canvas-performance.md). Keyed by tab, so two
// canvases side by side each publish their own.
import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { sketchBackdropIds, type Element, type Finish } from '@liveplanner/project';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

const byTab = new Map<string, ReadonlySet<string>>();
const listeners = createListeners();

const sameSet = (a: ReadonlySet<string> | undefined, b: ReadonlySet<string>) =>
  (a?.size ?? 0) === b.size && [...b].every((id) => a?.has(id));

function publish(tabId: string, ids: ReadonlySet<string>): void {
  if (sameSet(byTab.get(tabId), ids)) return;
  if (ids.size === 0) byTab.delete(tabId);
  else byTab.set(tabId, ids);
  listeners.notify();
}

const isBackdrop = (id: string) => {
  for (const ids of byTab.values()) if (ids.has(id)) return true;
  return false;
};

/** Publishes a tab's sketch backdrops from its drawn elements (the elements layer calls this). */
export function usePublishSketchBackdrops(
  tabId: string,
  elements: readonly Element[],
  tabFinish: Finish | undefined,
): void {
  const ids = useMemo(() => sketchBackdropIds(elements, tabFinish), [elements, tabFinish]);
  useLayoutEffect(() => publish(tabId, ids), [tabId, ids]);
  useLayoutEffect(() => () => publish(tabId, new Set()), [tabId]);
}

/** Whether something sits on this element, so under Sketch it keeps a solid fill. */
export function useIsSketchBackdrop(id: string): boolean {
  return useSyncExternalStore(
    listeners.subscribe,
    () => isBackdrop(id),
    () => false,
  );
}
