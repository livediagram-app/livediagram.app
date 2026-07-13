// Diagram-level lifecycle + navigation for the EDITOR surface. The
// list-level operations (open / rename / delete / move / duplicate /
// folder delete / dismiss shared) live in useDiagramListActions,
// shared with /explorer and /new; this hook wires them to the
// editor's state (current diagram, Explorer list, shared list) and
// adds the two editor-only actions: newDiagram (hand off to /live/new)
// and makeCopy (visitor copies the open shared diagram).
//
// Navigation is deliberately a hard `window.location.assign` rather
// than client routing: the editor's hydration path owns identity +
// load, and the current diagram is already autosaved, so a reload is
// the simplest correct handoff (spec/14).

import type { Dispatch, SetStateAction } from 'react';
import {
  apiCopyDiagram,
  apiSetDiagramFolder,
  type DiagramListItem,
  type SharedWithItem,
} from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import type { useConfirm } from '@/hooks/ui/useConfirm';
import { useDiagramListActions } from '@/hooks/persistence/useDiagramListActions';
import { useToast } from '@/hooks/ui/useToast';

type DiagramActionsDeps = {
  diagramId: string | null;
  diagramName: string;
  diagramList: DiagramListItem[];
  setDiagramList: Dispatch<SetStateAction<DiagramListItem[]>>;
  confirm: ReturnType<typeof useConfirm>;
  ownerId: string;
  // useFolders' delete, wrapped by the shared hook with a
  // diagram-side re-bucket.
  hookDeleteFolder: (id: string) => void;
  // Shared-with-you list, for the dismiss action surfaced in the
  // Explorer panel's Shared accordion.
  sharedDiagrams: SharedWithItem[];
  setSharedDiagrams: Dispatch<SetStateAction<SharedWithItem[]>>;
  copying: boolean;
  setCopying: (copying: boolean) => void;
  // The session's share code (edit/view visitors), forwarded to the
  // copy endpoint for authorisation.
  sessionShareCode: string | null;
  // Post-move refreshes for the scope-aware mover below: the team
  // libraries sweep (a row moved within / left a team) and the personal
  // list (a diagram landed in — or left — My Work).
  refreshTeamLibraries: () => void;
  refreshDiagramList: () => Promise<void> | void;
  // Fired after a successful scope-aware move so the editor can sync any
  // state derived from the moved diagram's placement — the header's
  // Private / Team badge reads the CURRENT diagram's teamId, which
  // otherwise goes stale until a reload.
  onDiagramScopeChanged?: (diagramId: string, teamId: string | null) => void;
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
    sharedDiagrams,
    setSharedDiagrams,
    copying,
    setCopying,
    sessionShareCode,
    refreshTeamLibraries,
    refreshDiagramList,
    onDiagramScopeChanged,
  } = deps;

  const toast = useToast();

  const {
    openDiagram,
    deleteDiagram,
    deleteFolder,
    moveDiagramToFolder,
    duplicateDiagram,
    dismissSharedDiagram,
  } = useDiagramListActions({
    ownerId,
    diagramList,
    setDiagramList,
    confirm,
    toast,
    deleteFolderFromHook: hookDeleteFolder,
    currentDiagram: diagramId ? { id: diagramId, name: diagramName } : null,
    // Open the freshly created copy. Navigation reloads the editor
    // onto the new id, so a separate list refresh is unnecessary.
    afterDuplicate: (newId) => openDiagram(newId),
    sharedDiagrams,
    setSharedDiagrams,
  });

  // Scope-crossing move (spec/35), for the Explorer panel's move picker
  // when a TEAM is involved on either side: re-folder within a team, file
  // a personal diagram into a team, or bring a team diagram back to the
  // personal tree (ownership transfers to the mover server-side). One API
  // call covers every case; afterwards both the team sweep and the
  // personal list refresh so the row surfaces wherever it landed.
  // (Purely personal moves stay on moveDiagramToFolder above — it updates
  // the list optimistically.)
  const moveDiagramTo = (id: string, dest: { teamId: string | null; folderId: string | null }) => {
    void apiSetDiagramFolder(ownerId, id, dest.folderId, dest.teamId)
      .then(() => {
        refreshTeamLibraries();
        void refreshDiagramList();
        onDiagramScopeChanged?.(id, dest.teamId);
        toast.success(dest.teamId ? 'Moved to the team library' : 'Moved to My Work');
      })
      .catch(() => {
        toast.error('Could not move the diagram. Please try again.');
      });
    track('Team', 'Moved', 'Diagram');
  };

  // "New Diagram" from the Explorer. Welcome / create-new lives at
  // /live/new (spec/14), so hand off there; that route owns the
  // identity + template + theme picker and the actual diagram POST.
  // The current diagram is already autosaved so nothing is lost.
  const newDiagram = () => {
    if (typeof window === 'undefined') return;
    window.location.assign(`${window.location.origin}/new`);
  };

  // Visitor action: duplicate the currently-open shared diagram
  // into the caller's own files. Goes to the api worker's copy
  // endpoint which authorises via owner / shared_with row / share
  // code (spec/11), then navigates to the new diagram so the
  // visitor immediately lands on their own copy. Owner case never
  // hits this; the button is gated on `!isOwner`.
  const makeCopy = async () => {
    if (!diagramId || copying) return;
    setCopying(true);
    try {
      const copy = await apiCopyDiagram(ownerId, diagramId, {
        shareCode: sessionShareCode,
      });
      // A visitor cloning someone else's shared diagram into their own
      // account; a distinct signal from duplicating your own (type 'Copy').
      track('Diagram', 'Duplicated', 'Copy');
      window.location.assign(`${window.location.origin}/diagram/${copy.id}`);
    } catch {
      // Network / auth glitch; let the user try again. Leave the
      // header button enabled by clearing the loading flag.
      setCopying(false);
    }
  };

  return {
    deleteDiagram,
    deleteFolder,
    moveDiagramToFolder,
    moveDiagramTo,
    duplicateDiagram,
    dismissSharedDiagram,
    newDiagram,
    openDiagram,
    makeCopy,
  };
}
