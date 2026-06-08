// Diagram-level lifecycle + navigation, lifted out of editor-page.tsx:
// delete / duplicate / move-to-folder / delete-folder, and the
// navigation helpers (new / open / make-a-copy) that hand off to a
// full-page load. These operate on whole diagrams (and the Explorer
// list), distinct from the per-tab lifecycle in useTabActions.
//
// Navigation is deliberately a hard `window.location.assign` rather
// than client routing: the editor's hydration path owns identity +
// load, and the current diagram is already autosaved, so a reload is
// the simplest correct handoff (spec/14). The Explorer list is updated
// optimistically (delete / move) so rows react instantly without
// waiting on a refetch that used to race the mutation.

import type { Dispatch, SetStateAction } from 'react';
import { apiCopyDiagram, apiDeleteDiagram, apiSetDiagramFolder } from '@/lib/api-client';
import { duplicateDiagram as duplicate } from '@/lib/duplicate-diagram';
import { track } from '@/lib/telemetry';
import type { useConfirm } from '@/hooks/useConfirm';

type DiagramListItem = {
  id: string;
  name: string;
  folderId: string | null;
  savedAt: number;
  shareCode: string | null;
};

type DiagramActionsDeps = {
  diagramId: string | null;
  diagramName: string;
  diagramList: DiagramListItem[];
  setDiagramList: Dispatch<SetStateAction<DiagramListItem[]>>;
  confirm: ReturnType<typeof useConfirm>;
  ownerId: string;
  // useFolders' delete, wrapped here with a diagram-side re-bucket.
  hookDeleteFolder: (id: string) => void;
  // Guards the visitor "make a copy" button against double-submits.
  copying: boolean;
  setCopying: (copying: boolean) => void;
  // The session's share code (edit/view visitors), forwarded to the
  // copy endpoint for authorisation.
  sessionShareCode: string | null;
};

export function useDiagramActions(deps: DiagramActionsDeps) {
  const {
    diagramId,
    diagramName,
    diagramList,
    setDiagramList,
    confirm,
    ownerId,
    hookDeleteFolder,
    copying,
    setCopying,
    sessionShareCode,
  } = deps;

  // Open a different diagram from the Explorer list. The auto-save has
  // already persisted the current diagram so nothing is lost. Path
  // scheme per spec/14.
  const openDiagram = (id: string, shareCode?: string) => {
    if (typeof window === 'undefined') return;
    if (id === diagramId) return;
    // Shared-list rows pass a share code so the non-owner can
    // actually load the target diagram — without it the editor's
    // hydration goes through the owner-only `/api/diagrams/:id`
    // path and 404s.
    const url = shareCode
      ? `${window.location.origin}/live/diagram/${id}?s=${encodeURIComponent(shareCode)}`
      : `${window.location.origin}/live/diagram/${id}`;
    window.location.assign(url);
  };

  // Delete a diagram by id. When the target is the currently-open one,
  // redirect to /live/explorer so the user lands on their library (the
  // editor would otherwise be staring at a row that no longer exists),
  // where they can pick another diagram or start a new one. Deleting any
  // *other* diagram just hits the API + refreshes the Explorer list. Not
  // undoable — the menu is an explicit action.
  const deleteDiagram = async (id: string) => {
    if (typeof window === 'undefined') return;
    const target = id === diagramId ? { name: diagramName } : diagramList.find((d) => d.id === id);
    const ok = await confirm({
      title: `Delete "${target?.name || 'this diagram'}"?`,
      message:
        'Every tab, change-log entry, and share link on this diagram is removed. Visitors holding a share link will see a 404. This cannot be undone.',
      confirmLabel: 'Delete diagram',
    });
    if (!ok) return;
    track('Diagram', 'Deleted');
    if (id === diagramId) {
      void apiDeleteDiagram(ownerId, id).catch(() => {});
      window.location.assign(`${window.location.origin}/live/explorer`);
      return;
    }
    // Optimistic local removal so the Recent row disappears the
    // moment the user clicks Delete. The previous shape was a
    // fire-and-forget apiDeleteDiagram followed by an immediate
    // refreshDiagramList: the DELETE and the GET raced, and the
    // refresh frequently won, repainting the row that the API
    // hadn't yet committed. Users had to click Delete twice to
    // make it stick.
    setDiagramList((prev) => prev.filter((d) => d.id !== id));
    void apiDeleteDiagram(ownerId, id).catch(() => {});
  };

  // Folder helpers (spec/15). createFolder / renameFolder come
  // straight from useFolders; deleteFolder wraps the hook with a
  // diagram-side cascade so diagrams that pointed at the deleted
  // folder visibly re-bucket to Unsorted instead of waiting for
  // the next list refresh.
  const deleteFolder = async (id: string) => {
    const ok = await confirm({
      title: 'Delete this folder?',
      message:
        'Diagrams inside the folder move to Unsorted. Subfolders are promoted to the root. The folder row itself is removed.',
      confirmLabel: 'Delete folder',
    });
    if (!ok) return;
    setDiagramList((prev) => prev.map((d) => (d.folderId === id ? { ...d, folderId: null } : d)));
    hookDeleteFolder(id);
  };

  const moveDiagramToFolder = (id: string, folderId: string | null) => {
    setDiagramList((prev) => prev.map((d) => (d.id === id ? { ...d, folderId } : d)));
    void apiSetDiagramFolder(ownerId, id, folderId).catch(() => {});
    track('Diagram', 'Moved');
  };

  // Duplicate a diagram into a brand-new one. Loads the source's
  // metadata + every tab's content, mints new tab ids (otherwise they
  // collide with the source when the user opens both), preserves
  // element ids inside each tab (arrows + same-tab links keep
  // resolving), and rewrites any tab-link references on the new tabs
  // through the id remap so cross-tab navigation survives the copy.
  const duplicateDiagram = async (id: string) => {
    const newId = await duplicate(ownerId, id);
    // Open the freshly created copy. Navigation reloads the editor onto
    // the new id, so a separate list refresh is unnecessary.
    if (newId) {
      track('Diagram', 'Duplicated');
      openDiagram(newId);
    }
  };

  // "New Diagram" from the Explorer. Welcome / create-new lives at
  // /live/new (spec/14), so hand off there — that route owns the
  // identity + template + theme picker and the actual diagram POST.
  // The current diagram is already autosaved so nothing is lost.
  const newDiagram = () => {
    if (typeof window === 'undefined') return;
    window.location.assign(`${window.location.origin}/live/new`);
  };

  // Visitor action: duplicate the currently-open shared diagram
  // into the caller's own files. Goes to the api worker's copy
  // endpoint which authorises via owner / shared_with row / share
  // code (spec/11), then navigates to the new diagram so the
  // visitor immediately lands on their own copy. Owner case never
  // hits this — the button is gated on `!isOwner`.
  const makeCopy = async () => {
    if (!diagramId || copying) return;
    setCopying(true);
    try {
      const copy = await apiCopyDiagram(ownerId, diagramId, {
        shareCode: sessionShareCode,
      });
      // A visitor cloning someone else's shared diagram into their own
      // account — a distinct signal from duplicating your own (type 'Copy').
      track('Diagram', 'Duplicated', 'Copy');
      window.location.assign(`${window.location.origin}/live/diagram/${copy.id}`);
    } catch {
      // Network / auth glitch — let the user try again. Leave the
      // header button enabled by clearing the loading flag.
      setCopying(false);
    }
  };

  return {
    deleteDiagram,
    deleteFolder,
    moveDiagramToFolder,
    duplicateDiagram,
    newDiagram,
    openDiagram,
    makeCopy,
  };
}
