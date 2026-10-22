'use client';

import type { RefObject } from 'react';
import type { Layer } from '@livedesign/document';
import { useRowPointerDrag } from '@/components/primitives/useRowPointerDrag';

// Drag a layer row onto another to take its slot (docs/specs/006-document/layers.md), on the shared pointer
// drag (useRowPointerDrag): dropping ON a row means "take that row's slot", whichever half it lands in.
export function useLayerRowDrag({
  listRef,
  layers,
  renamingId,
  onReorderLayer,
}: {
  // The <ul> the rows live in. Owned by the panel (its row menu measures
  // against the same element), so it is passed in rather than created here.
  listRef: RefObject<HTMLUListElement | null>;
  // Bottom -> top, the data order, which is what onReorderLayer indexes into.
  layers: readonly Layer[];
  renamingId: string | null;
  onReorderLayer: (layerId: string, toIndex: number) => void;
}) {
  const { dragId, over, rowPointerDown, rowPointerMove, rowPointerUp } = useRowPointerDrag({
    listRef,
    renamingId,
    onDrop: (id, targetId) => {
      // Convert the target's position back to the bottom->top data index.
      const toIndex = layers.findIndex((l) => l.id === targetId);
      if (toIndex >= 0) onReorderLayer(id, toIndex);
    },
  });
  const dropTargetId = over?.id ?? null;

  // Which edge of the target the insertion line sits on. Rows list top layer first, so a target
  // higher in the stack (a larger data index) sits ABOVE the dragged row on screen, and the row
  // lands above it; a lower target means it lands below.
  const dropEdge: 'top' | 'bottom' | null = (() => {
    if (!dragId || !dropTargetId) return null;
    const from = layers.findIndex((l) => l.id === dragId);
    const to = layers.findIndex((l) => l.id === dropTargetId);
    return to > from ? 'top' : 'bottom';
  })();

  return { dragId, dropTargetId, dropEdge, rowPointerDown, rowPointerMove, rowPointerUp };
}
