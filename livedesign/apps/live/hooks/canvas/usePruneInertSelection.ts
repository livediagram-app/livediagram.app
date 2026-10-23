'use client';

// A layer turning hidden or locked (locally or by a peer) drops its elements from the live selection,
// the same guarantee delete gives (docs/specs/006-design/layers.md). A layout effect on the inert
// set reads the selection store, so a hidden element is never painted selected and the editor root
// does not render for the selection (docs/specs/008-canvas/blueprints/selection-store.md).

import { useLayoutEffect } from 'react';
import type { SelectionStore } from '@/lib/selection-store';

// `kept`: inert ids that are selected another way and stay selected (a chart its Sheet draws, selected there to open
// its element menu).
export function usePruneInertSelection(
  inertIds: ReadonlySet<string>,
  selection: SelectionStore,
  kept?: ReadonlySet<string>,
) {
  useLayoutEffect(() => {
    const { selectedId, multiSelectedIds } = selection.get();
    const drops = (id: string) => inertIds.has(id) && !kept?.has(id);
    const single = selectedId !== null && drops(selectedId) ? null : selectedId;
    const multi = [...multiSelectedIds].some(drops)
      ? new Set([...multiSelectedIds].filter((id) => !drops(id)))
      : multiSelectedIds;
    selection.setSelection({ selectedId: single, multiSelectedIds: multi });
  }, [inertIds, selection, kept]);
}
