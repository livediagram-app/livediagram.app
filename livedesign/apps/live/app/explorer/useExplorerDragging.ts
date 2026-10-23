'use client';

import { useEffect, useState } from 'react';
import { explorerDragKind } from '@/components/panels/explorer-drag-mime';

// Whether a design or folder is being dragged anywhere on the Explorer page, and which
// (docs/specs/013-workspace/explorer-structure.md "Dragging to the Trash"): the Trash wakes as a target for the whole
// drag, not only once the pointer reaches it. Read from the drag's types at its start; a drag of anything else (text,
// a desktop file) is none. The drag ends on `dragend` at its source, or on a drop anywhere.

export function useExplorerDragging(): 'design' | 'folder' | null {
  const [kind, setKind] = useState<'design' | 'folder' | null>(null);
  useEffect(() => {
    const start = (e: DragEvent) => setKind(explorerDragKind([...(e.dataTransfer?.types ?? [])]));
    const end = () => setKind(null);
    window.addEventListener('dragstart', start);
    window.addEventListener('dragend', end);
    window.addEventListener('drop', end);
    return () => {
      window.removeEventListener('dragstart', start);
      window.removeEventListener('dragend', end);
      window.removeEventListener('drop', end);
    };
  }, []);
  return kind;
}
