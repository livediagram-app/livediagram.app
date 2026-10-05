'use client';

// A layer turning hidden or locked (locally or by a peer) drops its elements from the live selection,
// the same guarantee delete gives (docs/specs/006-document/layers.md). A layout effect on the inert
// set reads the selection store, so a hidden element is never painted selected and the editor root
// does not render for the selection (docs/specs/008-canvas/blueprints/selection-store.md).

import { useLayoutEffect } from 'react';
import type { SelectionStore } from '@/lib/selection-store';

export function usePruneInertSelection(inertIds: ReadonlySet<string>, selection: SelectionStore) {
  useLayoutEffect(() => {
    const { selectedId, multiSelectedIds } = selection.get();
    const single = selectedId !== null && inertIds.has(selectedId) ? null : selectedId;
    const multi = [...multiSelectedIds].some((id) => inertIds.has(id))
      ? new Set([...multiSelectedIds].filter((id) => !inertIds.has(id)))
      : multiSelectedIds;
    selection.setSelection({ selectedId: single, multiSelectedIds: multi });
  }, [inertIds, selection]);
}
