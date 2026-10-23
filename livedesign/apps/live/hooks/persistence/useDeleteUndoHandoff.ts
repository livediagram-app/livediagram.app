'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/ui/useToast';
import { offerDeleteUndo, takeDeleteUndo } from '@/lib/design-delete-undo';
import { useLatest } from '@/hooks/ui/useLatest';

// The open design's delete lands here (docs/specs/013-workspace/trash.md "Deleting"): the editor left for the
// Explorer straight after it, so its "Design deleted" toast, with its Undo, is offered on arrival. Once the owner
// is known; `onRestored` re-reads the lists the design comes back into.
export function useDeleteUndoHandoff(ownerId: string | null, onRestored: () => void): void {
  const toast = useToast();
  const restored = useLatest(onRestored);
  useEffect(() => {
    if (!ownerId) return;
    const handed = takeDeleteUndo();
    if (!handed) return;
    offerDeleteUndo(toast, { ownerId, ...handed, onRestored: () => restored.current() });
  }, [ownerId, toast, restored]);
}
