'use client';

// One project's own Timeline, from the row menu (docs/specs/013-workspace/timeline.md §3.4).
//
// A dialog rather than a page, because "what happened to this?" is a
// question you ask while looking at the row — bouncing to a route and
// back would lose your place in the library.
//
// The project-level story: created, renamed, commented on, shared,
// filed.

import { Dialog } from '@/components/dialogs/Dialog';
import { DialogHeader } from '@liveplanner/ui';
import { DocumentTimeline } from './ScopedTimeline';

export function ProjectHistoryDialog({
  open,
  onClose,
  ownerId,
  projectId,
  projectName,
}: {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  projectId: string | null;
  projectName: string | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} size="2xl" ariaLabel="Project history">
      <DialogHeader title="History" subtitle={projectName ?? undefined} />
      <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
        {/* Keyed on the id so switching rows remounts rather than
            showing the previous project's feed while the new one loads. */}
        {projectId ? (
          <DocumentTimeline key={projectId} ownerId={ownerId} projectId={projectId} />
        ) : null}
      </div>
    </Dialog>
  );
}
