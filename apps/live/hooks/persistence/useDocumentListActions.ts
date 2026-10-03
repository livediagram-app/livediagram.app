// List-level document + folder operations shared by every surface that
// renders a document library: the floating Explorer panel (composed
// into the editor via useDocumentActions), the /explorer page, and
// /new. Each surface owns its own list STATE (the editor refreshes it
// after autosave, the pages fetch on mount); this hook owns the
// BEHAVIOUR: the optimistic update, the API call, the telemetry, and
// the confirm copy, so the three surfaces can't drift. (They had:
// the pages were missing the Moved / Duplicated telemetry, and /new
// dismissed Shared rows without the confirm.)

import { truncateName } from '@livediagram/document';
import type { Dispatch, SetStateAction } from 'react';
import {
  apiDeleteDocument,
  apiDismissSharedWith,
  apiSaveDocumentMeta,
  apiSetDocumentFolder,
  type DocumentListItem,
  type SharedWithItem,
} from '@/lib/api-client';
import { duplicateDocument as duplicate } from '@/lib/duplicate-document';
import { markDocumentDeleted } from '@/lib/document-tombstones';
import { fetchSharedTabsNotice } from '@/lib/shared-tabs-notice';
import { deleteConfirmation, lookUpShareLinks } from '@/lib/delete-confirmation';
import { folderDeleteConfirmation } from '@/lib/folder-delete-confirmation';
import { folderDefaultKeys } from '@/lib/placement-defaults/default-destination';
import { placementDefaultsSnapshot } from '@/lib/placement-defaults/placement-defaults-store';
import { track } from '@/lib/telemetry';
import type { useConfirm } from '@/hooks/ui/useConfirm';
import type { useToast } from '@/hooks/ui/useToast';

// A personal folder as a delete needs it: its name and where it sits.
export type FolderNode = { id: string; name: string; parentId: string | null };

type DocumentListActionsDeps = {
  // The resolved owner id. Null / placeholder while identity is still
  // resolving; every op no-ops until a real id lands (matches what
  // each surface previously guarded by hand).
  ownerId: string | null;
  documentList: DocumentListItem[];
  setDocumentList: Dispatch<SetStateAction<DocumentListItem[]>>;
  confirm: ReturnType<typeof useConfirm>;
  // Confirmation / error toasts for the consequential list actions
  // (delete, move-to-folder, duplicate) whose result is otherwise
  // silent or off-screen. Single-sourced here so all three surfaces
  // (editor panel, /explorer, /new) get the same feedback. Success
  // toasts respect the user's "Show notifications" preference;
  // errors always surface (see useToast).
  toast: ReturnType<typeof useToast>;
  // useFolders' delete. deleteFolder below chains the document-side
  // cascade in front of it so rows visibly move up to the deleted folder's
  // parent instead of waiting for the next list refresh. Only DIRECT
  // children move, mirroring the server (docs/specs/013-workspace/folders.md
  // "Deleting a folder": subfolders keep their own contents).
  deleteFolderFromHook: (id: string) => void;
  // The personal folders, so the confirmation names the parent. Absent = [].
  folders?: readonly FolderNode[];
  // The document currently open in the editor, if the surface has
  // one. deleteDocument redirects to /live/explorer when deleting it
  // (the editor would otherwise stare at a row that no longer
  // exists) and openDocument no-ops on it. The standalone pages have
  // no current document and omit it.
  currentDocument?: { id: string; name: string } | null;
  // What to do once a duplicate exists: the editor opens the copy,
  // the standalone pages stay put and refresh their list.
  afterDuplicate: (newId: string) => void | Promise<void>;
  // Shared-with-you list state, for dismissSharedDocument. Optional:
  // surfaces without a Shared section omit both.
  sharedDocuments?: SharedWithItem[];
  setSharedDocuments?: Dispatch<SetStateAction<SharedWithItem[]>>;
};

export function useDocumentListActions(deps: DocumentListActionsDeps) {
  const {
    ownerId,
    documentList,
    setDocumentList,
    confirm,
    toast,
    deleteFolderFromHook,
    folders = [],
    currentDocument = null,
    afterDuplicate,
    sharedDocuments = [],
    setSharedDocuments,
  } = deps;

  // Open a document from a list row. The current document (editor only)
  // is already autosaved, so a hard navigation loses nothing; path
  // scheme per docs/specs/007-editor/new-document-route.md. Shared-list rows pass a share code so the
  // non-owner can actually load the target; without it the editor's
  // hydration goes through the owner-only `/api/documents/:id` path
  // and 404s.
  const openDocument = (id: string, shareCode?: string) => {
    if (typeof window === 'undefined') return;
    if (id === currentDocument?.id) return;
    const url = shareCode
      ? `${window.location.origin}/document/${id}?s=${encodeURIComponent(shareCode)}`
      : `${window.location.origin}/document/${id}`;
    window.location.assign(url);
  };

  // Rename a document from its list row. Optimistic; empty input is a
  // cancel, and the telemetry only fires when the name actually
  // changed.
  const renameDocument = (id: string, name: string) => {
    if (!ownerId) return;
    // docs/specs/006-document/name-length.md: one cap for every rename route.
    const trimmed = truncateName(name);
    if (!trimmed) return;
    const prev = documentList.find((d) => d.id === id);
    const prevName = prev?.name?.trim() ?? '';
    setDocumentList((p) => p.map((d) => (d.id === id ? { ...d, name: trimmed } : d)));
    void apiSaveDocumentMeta(ownerId, { id, name: trimmed })
      // Only once the server accepted it. Emitting beside the request counted
      // renames the very next line rolls back and toasts as failures.
      .then(() => {
        if (trimmed !== prevName) track('Document', 'Renamed');
      })
      .catch(() => {
        // Roll the optimistic rename back and surface the failure, matching
        // the other consequential list actions (delete / move / duplicate)
        // — a silent swallow left the row showing a name the server rejected.
        if (prev)
          setDocumentList((p) => p.map((d) => (d.id === id ? { ...d, name: prev.name } : d)));
        toast.error('Could not rename the document. Please try again.');
      });
  };

  // Delete a document by id. When the target is the currently-open one
  // (editor only), redirect to /live/explorer so the user lands on
  // their library rather than a dead row. Deleting any other document
  // removes the row optimistically: a fire-and-forget DELETE followed
  // by an immediate list refetch used to race, repainting the row the
  // API hadn't yet committed. It goes to the Trash (docs/specs/013-workspace/trash.md),
  // which the confirmation mentions once; there is no undo toast.
  //
  // `beforeRemove` runs after the delete is CONFIRMED and before the
  // row is pulled, so the caller can play a row exit animation (the
  // panel slides it out ~220ms). `skipConfirm` is passed by callers
  // that already confirmed inline (the panel's ConfirmPopover; the
  // modal would double-prompt).
  const deleteDocument = async (
    id: string,
    beforeRemove?: () => Promise<void> | void,
    opts?: { skipConfirm?: boolean },
  ) => {
    if (typeof window === 'undefined' || !ownerId) return;
    if (!opts?.skipConfirm) {
      const listed = documentList.find((d) => d.id === id);
      const name = id === currentDocument?.id ? currentDocument.name : listed?.name;
      // Tabs also in other documents stay there, and share links stop working:
      // said only when they apply (lib/delete-confirmation.ts).
      const [notice, hasShareLinks] = await Promise.all([
        fetchSharedTabsNotice(ownerId, id, 'delete'),
        listed ? Promise.resolve(listed.shareCode !== null) : lookUpShareLinks(ownerId, id),
      ]);
      const ok = await confirm(
        deleteConfirmation({ name, hasShareLinks, sharedTabsNotice: notice }),
      );
      if (!ok) return;
    }
    // Tombstone first, ALWAYS: the open editor's autosave (debounce + the
    // beforeunload keepalive beacon) must not write this document back. For
    // the open document that's the bug fix; for others it's harmless (their
    // editor isn't mounted) but keeps the rule simple. See document-tombstones.
    markDocumentDeleted(id);
    if (id === currentDocument?.id) {
      // AWAIT the delete before navigating: a fire-and-forget DELETE has no
      // keepalive, so the immediate navigation below would cancel the
      // in-flight request and the document would survive (the "didn't delete
      // first time" report). Awaiting sends it to completion first; the
      // tombstone then stops the beforeunload flush from re-creating it.
      // Telemetry rides the resolved delete, not the click: this used to fire
      // before the request was even sent. Emitting here is still delivered
      // despite the navigation below, because the client flushes its buffer
      // through sendBeacon on pagehide (@livediagram/telemetry-client).
      await apiDeleteDocument(ownerId, id)
        .then(() => track('Document', 'Deleted'))
        .catch(() => {});
      window.location.assign(`${window.location.origin}/explorer`);
      return;
    }
    await beforeRemove?.();
    setDocumentList((prev) => prev.filter((d) => d.id !== id));
    void apiDeleteDocument(ownerId, id)
      .then(() => track('Document', 'Deleted'))
      .catch(() => {});
    // The row is gone but on a long / scrolled list its disappearance
    // can be easy to miss, and the action is destructive — confirm it.
    toast.success('Document deleted');
  };

  // Delete a folder (docs/specs/013-workspace/folders.md "Deleting a folder"): confirm (naming
  // where the contents go, and warning when it is one of the reader's default folders), move its
  // direct documents up to its parent locally, then let useFolders handle the folder rows + the
  // API call. `name` personalises the confirm
  // title when the caller has it. Returns whether the delete went
  // through, so callers with selection state (the /explorer sidebar)
  // can bounce focus only on an actual delete.
  const deleteFolder = async (id: string, name?: string): Promise<boolean> => {
    const folder = folders.find((f) => f.id === id);
    const parentId = folder?.parentId ?? null;
    const ok = await confirm(
      folderDeleteConfirmation({
        name: name ?? folder?.name ?? '',
        parentName: folders.find((f) => f.id === parentId)?.name ?? null,
        scope: 'personal',
        defaultKeys: folderDefaultKeys(id, placementDefaultsSnapshot().defaults),
      }),
    );
    if (!ok) return false;
    setDocumentList((prev) =>
      prev.map((d) => (d.folderId === id ? { ...d, folderId: parentId } : d)),
    );
    deleteFolderFromHook(id);
    return true;
  };

  const moveDocumentToFolder = (id: string, folderId: string | null) => {
    if (!ownerId) return;
    const prevFolderId = documentList.find((d) => d.id === id)?.folderId ?? null;
    setDocumentList((prev) => prev.map((d) => (d.id === id ? { ...d, folderId } : d)));
    void apiSetDocumentFolder(ownerId, id, folderId)
      .then(() => {
        // The row leaves the current view (it's now under the target
        // folder / the root), so confirm where it went — only once the
        // server actually accepted the move.
        toast.success(folderId ? 'Moved to folder' : 'Moved to My documents');
        track('Document', 'Moved');
      })
      .catch(() => {
        // Roll the row back to its old folder and tell the user, instead
        // of swallowing the error after already claiming success.
        setDocumentList((prev) =>
          prev.map((d) => (d.id === id ? { ...d, folderId: prevFolderId } : d)),
        );
        toast.error('Could not move the document. Please try again.');
      });
  };

  // Duplicate a document into a brand-new one (new tab ids, preserved
  // element ids, tab-link references remapped; see
  // lib/duplicate-document). The surface decides what happens next via
  // afterDuplicate: open the copy (editor) or refresh the list
  // (standalone pages).
  const duplicateDocument = async (id: string) => {
    if (!ownerId) return;
    const newId = await duplicate(ownerId, id);
    if (newId) {
      track('Document', 'Duplicated');
      // Surfaces that stay put (the pages) get a confirmation; the
      // editor's afterDuplicate navigates to the copy, so its own
      // open is the feedback and this toast is simply preempted.
      toast.success('Document duplicated');
      await afterDuplicate(newId);
    } else {
      toast.error("Couldn't duplicate that document. Try again.");
    }
  };

  // Dismiss a single "shared with you" row. Confirmed because the row
  // is only re-creatable by re-opening the share link.
  const dismissSharedDocument = async (documentId: string) => {
    if (!ownerId || !setSharedDocuments) return;
    const target = sharedDocuments.find((d) => d.id === documentId);
    const ok = await confirm({
      title: `Remove "${target?.name || 'this document'}" from your Shared list?`,
      message:
        "It'll vanish from your Shared with you list. You can still open it again from the share link the owner gave you, and that re-adds it here.",
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    setSharedDocuments((prev) => prev.filter((d) => d.id !== documentId));
    void apiDismissSharedWith(ownerId, documentId).catch(() => {});
  };

  return {
    openDocument,
    renameDocument,
    deleteDocument,
    deleteFolder,
    moveDocumentToFolder,
    duplicateDocument,
    dismissSharedDocument,
  };
}
