import { useEffect, useRef, useState } from 'react';
import type { ExplorerProps } from './Explorer.types';

// The Explorer's row-delete lifecycle (spec/15), lifted out of the
// panel: the inline ConfirmPopover state + anchor, the slide-out
// exit-animation id set, the optimistic hide-set for team rows (their
// library sweep can't prune in time), and the two effects that prune
// both sets once the lists actually drop the deleted ids. The panel
// renders the popover and rows from what this returns.
export function useExplorerRowDelete({
  diagrams,
  teamDiagrams,
  onDeleteDiagram,
}: Pick<ExplorerProps, 'diagrams' | 'onDeleteDiagram'> & {
  teamDiagrams: NonNullable<ExplorerProps['teamDiagrams']>;
}) {
  // Diagrams currently mid slide-out animation. Adding the id to this
  // set switches the row's <li> className from animate-slide-row-in to
  // animate-slide-row-out for ~220ms, then we forward the real delete
  // to the parent so the row is removed from the underlying
  // `diagrams` prop. Without the delay the row disappears instantly
  // and a fresh "5 with the same name" Explorer feels unresponsive.
  const [exitingDiagramIds, setExitingDiagramIds] = useState<Set<string>>(new Set());
  // Inline delete confirmation: the row's menu hands up the id + its menu
  // button as the anchor; we open a ConfirmPopover beside it. Confirming
  // runs the delete (skipping the modal — the popover IS the confirm) and
  // slides the row out first via the beforeRemove hook.
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string } | null>(null);
  const deleteAnchorRef = useRef<HTMLElement | null>(null);
  // Team diagrams aren't in the personal `diagrams` prop, so the parent's
  // delete (which prunes the personal list + fires a fire-and-forget API
  // DELETE) can't drop a team row from view, and the team-library sweep
  // won't re-fetch in time. Track confirmed team deletes locally and hide
  // those rows optimistically; the set is pruned once the sweep catches up.
  const [deletedTeamIds, setDeletedTeamIds] = useState<Set<string>>(new Set());
  const openDeleteConfirm = onDeleteDiagram
    ? (id: string, anchor: HTMLElement | null) => {
        deleteAnchorRef.current = anchor;
        setDeleteConfirm({ id });
      }
    : undefined;
  const runDelete = (id: string) => {
    if (!onDeleteDiagram) return;
    // A team diagram lives in the swept library, not the personal list,
    // so hide it locally on confirm (the parent's delete can't).
    if (teamDiagrams.some((d) => d.id === id)) {
      setDeletedTeamIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
    void onDeleteDiagram(
      id,
      () =>
        new Promise<void>((resolve) => {
          setExitingDiagramIds((prev) => {
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
  // and keeps the set from growing across repeated deletes.
  useEffect(() => {
    setExitingDiagramIds((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(diagrams.map((d) => d.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (present.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [diagrams]);

  // Same pruning for team deletes: once the library sweep re-fetches
  // without the deleted id, drop it from the local hide-set so the set
  // can't grow unbounded.
  useEffect(() => {
    setDeletedTeamIds((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(teamDiagrams.map((d) => d.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (present.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [teamDiagrams]);
  return {
    exitingDiagramIds,
    deleteConfirm,
    setDeleteConfirm,
    deleteAnchorRef,
    deletedTeamIds,
    openDeleteConfirm,
    runDelete,
  };
}
