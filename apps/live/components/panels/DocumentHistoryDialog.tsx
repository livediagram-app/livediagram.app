'use client';

// One diagram's own Timeline, from the row menu (docs/specs/013-workspace/timeline.md §3.4).
//
// A dialog rather than a page, because "what happened to this?" is a
// question you ask while looking at the row — bouncing to a route and
// back would lose your place in the library.
//
// Distinct from the editor's Activity Panel (docs/specs/012-collaboration/activity-and-audit.md), which is
// element-level, tab-scoped and revertable. This is the diagram-level
// story: created, renamed, commented on, shared, filed — the events
// docs/specs/012-collaboration/activity-and-audit.md explicitly left out of scope.

import { Dialog } from '@/components/dialogs/Dialog';
import { DialogHeader } from '@/components/dialogs/DialogHeader';
import { DocumentTimeline } from './ScopedTimeline';

export function DocumentHistoryDialog({
  open,
  onClose,
  ownerId,
  documentId,
  documentName,
}: {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  documentId: string | null;
  documentName: string | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} size="2xl" ariaLabel="Diagram history">
      <DialogHeader title="History" subtitle={documentName ?? undefined} />
      <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
        {/* Keyed on the id so switching rows remounts rather than
            showing the previous diagram's feed while the new one loads. */}
        {documentId ? (
          <DocumentTimeline key={documentId} ownerId={ownerId} documentId={documentId} />
        ) : null}
      </div>
    </Dialog>
  );
}
