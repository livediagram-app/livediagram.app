// Diagram-level lifecycle + navigation for the EDITOR surface. The
// list-level operations (open / rename / delete / move / duplicate /
// folder delete / dismiss shared) live in useDocumentListActions,
// shared with /explorer and /new; this hook wires them to the
// editor's state (current diagram, Explorer list, shared list) and
// adds the two editor-only actions: newDocument (hand off to /live/new)
// and makeCopy (visitor copies the open shared diagram).
//
// Navigation is deliberately a hard `window.location.assign` rather
// than client routing: the editor's hydration path owns identity +
// load, and the current diagram is already autosaved, so a reload is
// the simplest correct handoff (docs/specs/007-editor/new-document-route.md).

import type { Dispatch, SetStateAction } from 'react';
import {
  apiCopyDocument,
  apiSetDocumentFolder,
  type DocumentListItem,
  type SharedWithItem,
} from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import type { useConfirm } from '@/hooks/ui/useConfirm';
import { useDocumentListActions } from '@/hooks/persistence/useDocumentListActions';
import { useToast } from '@/hooks/ui/useToast';

type DocumentActionsDeps = {
  documentId: string | null;
  documentName: string;
  documentList: DocumentListItem[];
  setDocumentList: Dispatch<SetStateAction<DocumentListItem[]>>;
  confirm: ReturnType<typeof useConfirm>;
  ownerId: string;
  // useFolders' delete, wrapped by the shared hook with a
  // diagram-side re-bucket.
  hookDeleteFolder: (id: string) => void;
  // Shared-with-you list, for the dismiss action surfaced in the
  // Explorer panel's Shared accordion.
  sharedDocuments: SharedWithItem[];
  setSharedDocuments: Dispatch<SetStateAction<SharedWithItem[]>>;
  copying: boolean;
  setCopying: (copying: boolean) => void;
  // The session's share code (edit/view visitors), forwarded to the
  // copy endpoint for authorisation.
  sessionShareCode: string | null;
  // Post-move refreshes for the scope-aware mover below: the team
  // libraries sweep (a row moved within / left a team) and the personal
  // list (a diagram landed in — or left — Personal Space).
  refreshTeamLibraries: () => void;
  refreshDocumentList: () => Promise<void> | void;
  // Fired after a successful scope-aware move so the editor can sync any
  // state derived from the moved diagram's placement — the header's
  // Private / Team badge reads the CURRENT diagram's teamId, which
  // otherwise goes stale until a reload.
  onDocumentScopeChanged?: (documentId: string, teamId: string | null) => void;
};

export function useDocumentActions(deps: DocumentActionsDeps) {
  const {
    documentId,
    documentName,
    documentList,
    setDocumentList,
    confirm,
    ownerId,
    hookDeleteFolder,
    sharedDocuments,
    setSharedDocuments,
    copying,
    setCopying,
    sessionShareCode,
    refreshTeamLibraries,
    refreshDocumentList,
    onDocumentScopeChanged,
  } = deps;

  const toast = useToast();

  const {
    openDocument,
    deleteDocument,
    deleteFolder,
    moveDocumentToFolder,
    duplicateDocument,
    dismissSharedDocument,
  } = useDocumentListActions({
    ownerId,
    documentList,
    setDocumentList,
    confirm,
    toast,
    deleteFolderFromHook: hookDeleteFolder,
    currentDocument: documentId ? { id: documentId, name: documentName } : null,
    // Open the freshly created copy. Navigation reloads the editor
    // onto the new id, so a separate list refresh is unnecessary.
    afterDuplicate: (newId) => openDocument(newId),
    sharedDocuments,
    setSharedDocuments,
  });

  // Scope-crossing move (docs/specs/013-workspace/team-shared-documents.md), for the Explorer panel's move picker
  // when a TEAM is involved on either side: re-folder within a team, file
  // a personal diagram into a team, or bring a team diagram back to the
  // personal tree (ownership transfers to the mover server-side). One API
  // call covers every case; afterwards both the team sweep and the
  // personal list refresh so the row surfaces wherever it landed.
  // (Purely personal moves stay on moveDocumentToFolder above — it updates
  // the list optimistically.)
  //
  // Telemetry (docs/specs/017-telemetry/telemetry.md), on the success path only: a personal diagram
  // filed into a team is Team·Added·Document, the same event the Explorer
  // page's own move and the New Diagram wizard send; anything else (within
  // a team, team -> team, team -> personal) is Team·Moved·Document. An
  // unknown source (a caller that doesn't pass `fromTeamId`, e.g. the team
  // library, whose rows are always team diagrams) reads as a team move.
  const moveDocumentTo = (
    id: string,
    dest: { teamId: string | null; folderId: string | null },
    fromTeamId?: string | null,
  ) => {
    void apiSetDocumentFolder(ownerId, id, dest.folderId, dest.teamId)
      .then(() => {
        refreshTeamLibraries();
        void refreshDocumentList();
        onDocumentScopeChanged?.(id, dest.teamId);
        toast.success(dest.teamId ? 'Moved to the team library' : 'Moved to Personal Space');
        if (fromTeamId === null && dest.teamId) track('Team', 'Added', 'Document');
        else track('Team', 'Moved', 'Document');
      })
      .catch(() => {
        toast.error('Could not move the diagram. Please try again.');
      });
  };

  // "New Diagram" from the Explorer. Welcome / create-new lives at
  // /live/new (docs/specs/007-editor/new-document-route.md), so hand off there; that route owns the
  // identity + template + theme picker and the actual diagram POST.
  // The current diagram is already autosaved so nothing is lost.
  const newDocument = () => {
    if (typeof window === 'undefined') return;
    window.location.assign(`${window.location.origin}/new`);
  };

  // Visitor action: duplicate the currently-open shared diagram
  // into the caller's own files. Goes to the api worker's copy
  // endpoint which authorises via owner / shared_with row / share
  // code (docs/specs/015-api/api.md), then navigates to the new diagram so the
  // visitor immediately lands on their own copy. Owner case never
  // hits this; the button is gated on `!isOwner`.
  const makeCopy = async () => {
    if (!documentId || copying) return;
    setCopying(true);
    try {
      const copy = await apiCopyDocument(ownerId, documentId, {
        shareCode: sessionShareCode,
      });
      // A visitor cloning someone else's shared diagram into their own
      // account; a distinct signal from duplicating your own (type 'Copy').
      track('Document', 'Duplicated', 'Copy');
      window.location.assign(`${window.location.origin}/document/${copy.id}`);
    } catch {
      // Network / auth glitch; let the user try again. Leave the
      // header button enabled by clearing the loading flag.
      setCopying(false);
    }
  };

  return {
    deleteDocument,
    deleteFolder,
    moveDocumentToFolder,
    moveDocumentTo,
    duplicateDocument,
    dismissSharedDocument,
    newDocument,
    openDocument,
    makeCopy,
  };
}
