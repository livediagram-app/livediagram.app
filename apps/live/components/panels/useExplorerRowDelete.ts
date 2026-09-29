import { useRef, useState } from 'react';
import { fetchSharedTabsNotice } from '@/lib/shared-tabs-notice';
import type { ExplorerProps } from './Explorer.types';

// The Explorer's row-delete lifecycle (docs/specs/013-workspace/folders.md), lifted out of the
// panel: the inline ConfirmPopover state + anchor, the slide-out
// exit-animation id set, the optimistic hide-set for team rows (their
// library sweep can't prune in time), and the render-time pruning of
// both sets once the lists actually drop the deleted ids. The panel
// renders the popover and rows from what this returns.
export function useExplorerRowDelete({
  documents: liveDocs,
  teamDocuments,
  ownerId,
  onDeleteDocument,
}: Pick<ExplorerProps, 'documents' | 'ownerId' | 'onDeleteDocument'> & {
  teamDocuments: NonNullable<ExplorerProps['teamDocuments']>;
}) {
  // Diagrams currently mid slide-out animation. Adding the id to this
  // set flips the row's DiagramRowShell from its enter class to its exit
  // one for ~220ms, then we forward the real delete
  // to the parent so the row is removed from the underlying
  // `diagrams` prop. Without the delay the row disappears instantly
  // and a fresh "5 with the same name" Explorer feels unresponsive.
  const [exitingDocumentIds, setExitingDocumentIds] = useState<Set<string>>(new Set());
  // Inline delete confirmation: the row's menu hands up the id + its menu
  // button as the anchor; we open a ConfirmPopover beside it. Confirming
  // runs the delete (skipping the modal — the popover IS the confirm) and
  // slides the row out first via the beforeRemove hook. `notice` is the
  // shared-tab sentence (docs/specs/006-document/tab-document-many-to-many.md),
  // read before the popover opens so it never grows under the pointer.
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    notice: string | null;
    anchor: HTMLElement;
  } | null>(null);
  // The latest row asked about: a slower answer for an earlier row is dropped.
  const pendingDeleteRef = useRef<string | null>(null);
  // Team diagrams aren't in the personal `diagrams` prop, so the parent's
  // delete (which prunes the personal list + fires a fire-and-forget API
  // DELETE) can't drop a team row from view, and the team-library sweep
  // won't re-fetch in time. Track confirmed team deletes locally and hide
  // those rows optimistically; the set is pruned once the sweep catches up.
  const [deletedTeamIds, setDeletedTeamIds] = useState<Set<string>>(new Set());
  const openDeleteConfirm = onDeleteDocument
    ? async (id: string, anchor: HTMLElement | null) => {
        pendingDeleteRef.current = id;
        const notice = ownerId ? await fetchSharedTabsNotice(ownerId, id, 'delete') : null;
        if (pendingDeleteRef.current !== id) return;
        pendingDeleteRef.current = null;
        if (anchor) setDeleteConfirm({ id, notice, anchor });
      }
    : undefined;
  const runDelete = (id: string) => {
    if (!onDeleteDocument) return;
    // A team diagram lives in the swept library, not the personal list,
    // so hide it locally on confirm (the parent's delete can't).
    if (teamDocuments.some((d) => d.id === id)) {
      setDeletedTeamIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
    void onDeleteDocument(
      id,
      () =>
        new Promise<void>((resolve) => {
          setExitingDocumentIds((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
          });
          window.setTimeout(resolve, 220);
        }),
      { skipConfirm: true },
    );
  };

  // Once a deleted diagram actually leaves the list, drop its id from the
  // exiting set. Pruning here (rather than clearing on the timeout) avoids a
  // one-frame flicker where the row would slide back in just before unmount,
  // and keeps the set from growing across repeated deletes. Adjusted during
  // render when the list changes; only then, since a team row's id slides out
  // through this set too without ever being in the personal list.
  const [exitPrunedFor, setExitPrunedFor] = useState(liveDocs);
  if (liveDocs !== exitPrunedFor) {
    setExitPrunedFor(liveDocs);
    setExitingDocumentIds((prev) => keepPresent(prev, liveDocs));
  }

  // Same pruning for team deletes: once the library sweep re-fetches
  // without the deleted id, drop it from the local hide-set so the set
  // can't grow unbounded. A hidden id is always in the library when hidden, so
  // this prunes on content rather than list identity (the panel defaults the
  // library to a fresh [] per render).
  const keptTeamIds = keepPresent(deletedTeamIds, teamDocuments);
  if (keptTeamIds !== deletedTeamIds) setDeletedTeamIds(keptTeamIds);
  return {
    exitingDocumentIds,
    deleteConfirm,
    setDeleteConfirm,
    deletedTeamIds,
    openDeleteConfirm,
    runDelete,
  };
}

// The ids of `ids` still in `rows`; `ids` itself when none has gone, so a caller can tell nothing changed.
function keepPresent(ids: Set<string>, rows: readonly { id: string }[]): Set<string> {
  if (ids.size === 0) return ids;
  const present = new Set(rows.map((d) => d.id));
  const next = new Set([...ids].filter((id) => present.has(id)));
  return next.size === ids.size ? ids : next;
}
