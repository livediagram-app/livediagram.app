'use client';

// One design's own Timeline, from the row menu (docs/specs/013-workspace/timeline.md §3.4).
//
// A dialog rather than a page, because "what happened to this?" is a
// question you ask while looking at the row — bouncing to a route and
// back would lose your place in the library.
//
// The design-level story: created, renamed, commented on, shared,
// filed.

import { Dialog } from '@/components/dialogs/Dialog';
import { DialogHeader } from '@livedesign/ui';
import { DocumentTimeline } from './ScopedTimeline';

export function DesignHistoryDialog({
  open,
  onClose,
  ownerId,
  designId,
  designName,
}: {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  designId: string | null;
  designName: string | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} size="2xl" ariaLabel="Design history">
      <DialogHeader title="History" subtitle={designName ?? undefined} />
      <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
        {/* Keyed on the id so switching rows remounts rather than
            showing the previous design's feed while the new one loads. */}
        {designId ? (
          <DocumentTimeline key={designId} ownerId={ownerId} designId={designId} />
        ) : null}
      </div>
    </Dialog>
  );
}
