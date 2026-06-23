// List-level diagram + folder operations shared by every surface that
// renders a diagram library: the floating Explorer panel (composed
// into the editor via useDiagramActions), the /explorer page, and
// /new. Each surface owns its own list STATE (the editor refreshes it
// after autosave, the pages fetch on mount); this hook owns the
// BEHAVIOUR: the optimistic update, the API call, the telemetry, and
// the confirm copy, so the three surfaces can't drift. (They had:
// the pages were missing the Moved / Duplicated telemetry, and /new
// dismissed Shared rows without the confirm.)

import type { Dispatch, SetStateAction } from 'react';
import {
  apiDeleteDiagram,
  apiDismissSharedWith,
  apiSaveDiagramMeta,
  apiSetDiagramFolder,
  type DiagramListItem,
  type SharedWithItem,
} from '@/lib/api-client';
import { duplicateDiagram as duplicate } from '@/lib/duplicate-diagram';
import { track } from '@/lib/telemetry';
import type { useConfirm } from '@/hooks/ui/useConfirm';
import type { useToast } from '@/hooks/ui/useToast';

type DiagramListActionsDeps = {
  // The resolved owner id. Null / placeholder while identity is still
  // resolving; every op no-ops until a real id lands (matches what
  // each surface previously guarded by hand).
  ownerId: string | null;
  diagramList: DiagramListItem[];
  setDiagramList: Dispatch<SetStateAction<DiagramListItem[]>>;
  confirm: ReturnType<typeof useConfirm>;
  // Confirmation / error toasts for the consequential list actions
  // (delete, move-to-folder, duplicate) whose result is otherwise
  // silent or off-screen. Single-sourced here so all three surfaces
  // (editor panel, /explorer, /new) get the same feedback. Success
  // toasts respect the user's "Show notifications" preference;
  // errors always surface (see useToast).
  toast: ReturnType<typeof useToast>;
  // useFolders' delete. deleteFolder below chains the diagram-side
  // re-bucket cascade in front of it so rows visibly fall to
  // Unsorted instead of waiting for the next list refresh. Only
  // DIRECT children re-bucket, mirroring the server (subfolders are
  // promoted to root, so diagrams inside them stay put).
  deleteFolderFromHook: (id: string) => void;
  // The diagram currently open in the editor, if the surface has
  // one. deleteDiagram redirects to /live/explorer when deleting it
  // (the editor would otherwise stare at a row that no longer
  // exists) and openDiagram no-ops on it. The standalone pages have
  // no current diagram and omit it.
  currentDiagram?: { id: string; name: string } | null;
  // What to do once a duplicate exists: the editor opens the copy,
  // the standalone pages stay put and refresh their list.
  afterDuplicate: (newId: string) => void | Promise<void>;
  // Shared-with-you list state, for dismissSharedDiagram. Optional:
  // surfaces without a Shared section omit both.
  sharedDiagrams?: SharedWithItem[];
  setSharedDiagrams?: Dispatch<SetStateAction<SharedWithItem[]>>;
};

export function useDiagramListActions(deps: DiagramListActionsDeps) {
  const {
    ownerId,
    diagramList,
    setDiagramList,
    confirm,
    toast,
    deleteFolderFromHook,
    currentDiagram = null,
    afterDuplicate,
    sharedDiagrams = [],
    setSharedDiagrams,
  } = deps;

  // Open a diagram from a list row. The current diagram (editor only)
  // is already autosaved, so a hard navigation loses nothing; path
  // scheme per spec/14. Shared-list rows pass a share code so the
  // non-owner can actually load the target; without it the editor's
  // hydration goes through the owner-only `/api/diagrams/:id` path
  // and 404s.
  const openDiagram = (id: string, shareCode?: string) => {
    if (typeof window === 'undefined') return;
    if (id === currentDiagram?.id) return;
    const url = shareCode
      ? `${window.location.origin}/diagram/${id}?s=${encodeURIComponent(shareCode)}`
      : `${window.location.origin}/diagram/${id}`;
    window.location.assign(url);
  };

  // Rename a diagram from its list row. Optimistic; empty input is a
  // cancel, and the telemetry only fires when the name actually
  // changed.
  const renameDiagram = (id: string, name: string) => {
    if (!ownerId) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const prevName = diagramList.find((d) => d.id === id)?.name?.trim() ?? '';
    setDiagramList((prev) => prev.map((d) => (d.id === id ? { ...d, name: trimmed } : d)));
    void apiSaveDiagramMeta(ownerId, { id, name: trimmed }).catch(() => {});
    if (trimmed !== prevName) track('Diagram', 'Renamed');
  };

  // Delete a diagram by id. When the target is the currently-open one
  // (editor only), redirect to /live/explorer so the user lands on
  // their library rather than a dead row. Deleting any other diagram
  // removes the row optimistically: a fire-and-forget DELETE followed
  // by an immediate list refetch used to race, repainting the row the
  // API hadn't yet committed. Not undoable; the menu is an explicit
  // action.
  //
  // `beforeRemove` runs after the delete is CONFIRMED and before the
  // row is pulled, so the caller can play a row exit animation (the
  // panel slides it out ~220ms). `skipConfirm` is passed by callers
  // that already confirmed inline (the panel's ConfirmPopover; the
  // modal would double-prompt).
  const deleteDiagram = async (
    id: string,
    beforeRemove?: () => Promise<void> | void,
    opts?: { skipConfirm?: boolean },
  ) => {
    if (typeof window === 'undefined' || !ownerId) return;
    if (!opts?.skipConfirm) {
      const target =
        id === currentDiagram?.id
          ? { name: currentDiagram.name }
          : diagramList.find((d) => d.id === id);
      const ok = await confirm({
        title: `Delete "${target?.name || 'this diagram'}"?`,
        message:
          'Every tab, change-log entry, and share link on this diagram is removed. Visitors holding a share link will see a 404. This cannot be undone.',
        confirmLabel: 'Delete diagram',
      });
      if (!ok) return;
    }
    track('Diagram', 'Deleted');
    if (id === currentDiagram?.id) {
      void apiDeleteDiagram(ownerId, id).catch(() => {});
      window.location.assign(`${window.location.origin}/explorer`);
      return;
    }
    await beforeRemove?.();
    setDiagramList((prev) => prev.filter((d) => d.id !== id));
    void apiDeleteDiagram(ownerId, id).catch(() => {});
    // The row is gone but on a long / scrolled list its disappearance
    // can be easy to miss, and the action is destructive — confirm it.
    toast.success('Diagram deleted');
  };

  // Delete a folder (spec/15): confirm, re-bucket its direct
  // diagrams to Unsorted locally, then let useFolders handle the
  // folder rows + the API call. `name` personalises the confirm
  // title when the caller has it. Returns whether the delete went
  // through, so callers with selection state (the /explorer sidebar)
  // can bounce focus only on an actual delete.
  const deleteFolder = async (id: string, name?: string): Promise<boolean> => {
    const ok = await confirm({
      title: name ? `Delete "${name}"?` : 'Delete this folder?',
      message:
        'Diagrams inside the folder move to Unsorted. Subfolders are promoted to the root. The folder row itself is removed.',
      confirmLabel: 'Delete folder',
    });
    if (!ok) return false;
    setDiagramList((prev) => prev.map((d) => (d.folderId === id ? { ...d, folderId: null } : d)));
    deleteFolderFromHook(id);
    return true;
  };

  const moveDiagramToFolder = (id: string, folderId: string | null) => {
    if (!ownerId) return;
    setDiagramList((prev) => prev.map((d) => (d.id === id ? { ...d, folderId } : d)));
    void apiSetDiagramFolder(ownerId, id, folderId).catch(() => {});
    track('Diagram', 'Moved');
    // The row leaves the current view (it's now under the target
    // folder / Unsorted), so confirm where it went.
    toast.success(folderId ? 'Moved to folder' : 'Moved to Unsorted');
  };

  // Duplicate a diagram into a brand-new one (new tab ids, preserved
  // element ids, tab-link references remapped; see
  // lib/duplicate-diagram). The surface decides what happens next via
  // afterDuplicate: open the copy (editor) or refresh the list
  // (standalone pages).
  const duplicateDiagram = async (id: string) => {
    if (!ownerId) return;
    const newId = await duplicate(ownerId, id);
    if (newId) {
      track('Diagram', 'Duplicated');
      // Surfaces that stay put (the pages) get a confirmation; the
      // editor's afterDuplicate navigates to the copy, so its own
      // open is the feedback and this toast is simply preempted.
      toast.success('Diagram duplicated');
      await afterDuplicate(newId);
    } else {
      toast.error("Couldn't duplicate that diagram. Try again.");
    }
  };

  // Dismiss a single "shared with you" row. Confirmed because the row
  // is only re-creatable by re-opening the share link.
  const dismissSharedDiagram = async (diagramId: string) => {
    if (!ownerId || !setSharedDiagrams) return;
    const target = sharedDiagrams.find((d) => d.id === diagramId);
    const ok = await confirm({
      title: `Remove "${target?.name || 'this diagram'}" from your Shared list?`,
      message:
        "It'll vanish from your Shared with you list. You can still open it again from the share link the owner gave you, and that re-adds it here.",
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    setSharedDiagrams((prev) => prev.filter((d) => d.id !== diagramId));
    void apiDismissSharedWith(ownerId, diagramId).catch(() => {});
  };

  return {
    openDiagram,
    renameDiagram,
    deleteDiagram,
    deleteFolder,
    moveDiagramToFolder,
    duplicateDiagram,
    dismissSharedDiagram,
  };
}
