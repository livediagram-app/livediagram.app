'use client';

// One diagram's own Timeline, from the row menu (spec/138 §3.4).
//
// A dialog rather than a page, because "what happened to this?" is a
// question you ask while looking at the row — bouncing to a route and
// back would lose your place in the library.
//
// Distinct from the editor's Activity Panel (spec/12), which is
// element-level, tab-scoped and revertable. This is the diagram-level
// story: created, renamed, commented on, shared, filed — the events
// spec/12 explicitly left out of scope.

import { Dialog } from '@/components/dialogs/Dialog';
import { DialogHeader } from '@/components/dialogs/DialogHeader';
import { DiagramTimeline } from './ScopedTimeline';

export function DiagramHistoryDialog({
  open,
  onClose,
  ownerId,
  diagramId,
  diagramName,
}: {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  diagramId: string | null;
  diagramName: string | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} size="2xl" ariaLabel="Diagram history">
      <DialogHeader title="History" subtitle={diagramName ?? undefined} />
      <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
        {/* Keyed on the id so switching rows remounts rather than
            showing the previous diagram's feed while the new one loads. */}
        {diagramId ? (
          <DiagramTimeline key={diagramId} ownerId={ownerId} diagramId={diagramId} />
        ) : null}
      </div>
    </Dialog>
  );
}
