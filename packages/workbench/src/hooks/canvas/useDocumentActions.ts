// The editor's verbs on whole documents: open one, start a new one, copy the open one, delete the open one. Documents are
// items of the central index (liveworkspace/docs/specs/004-index/one-explorer-contracts.md), so copy and delete go there; the index
// asks this app's api to copy the content. Everything else a document's row offers (move, rename, favourite, the
// Trash) is the shared Explorer's.
//
// Navigation is deliberately a hard `window.location.assign` rather
// than client routing: the editor's hydration path owns identity +
// load, and the current document is already autosaved, so a reload is
// the simplest correct handoff (docs/specs/007-editor/new-document-route.md).

import { indexClient } from '../../lib/index-client';
import type { useConfirm } from '../ui/useConfirm';
import { useToast } from '../ui/useToast';

// What each editor hands in, once, at module scope in its `hooks/canvas/useDocumentActions.ts`: its telemetry, its
// Trash step for the open item (lib/document-delete-undo), its session's share password (lib/api-client) and its
// failure copy (lib/write-failure-copy).
export type DocumentActionsBindings = {
  track: (category: 'Document', action: 'Duplicated' | 'Deleted', type?: 'Copy') => void;
  trashOpenDocument: (id: string, name: string) => Promise<boolean>;
  getSessionSharePassword: () => string | null;
  DOCUMENT_FAILURE: {
    duplicate: (name?: string) => string;
    delete: (name?: string) => string;
  };
};

type DocumentActionsDeps = {
  documentId: string | null;
  documentName: string;
  confirm: ReturnType<typeof useConfirm>;
  copying: boolean;
  setCopying: (copying: boolean) => void;
  // The link this session came in on: a visitor's copy reads the document through it.
  sessionShareCode: string | null;
};

export function createDocumentActions({
  track,
  trashOpenDocument,
  getSessionSharePassword,
  DOCUMENT_FAILURE,
}: DocumentActionsBindings) {
  return function useDocumentActions(deps: DocumentActionsDeps) {
  const { documentId, documentName, copying, setCopying, sessionShareCode } = deps;
  const toast = useToast();

  const openDocument = (id: string, shareCode?: string) => {
    const query = shareCode ? `?s=${encodeURIComponent(shareCode)}` : '';
    window.location.assign(`${window.location.origin}/document/${encodeURIComponent(id)}${query}`);
  };

  // New, from the editor: the /new flow (docs/specs/007-editor/new-document-route.md). The open document is saved.
  const newDocument = () => {
    if (typeof window === 'undefined') return;
    window.location.assign(`${window.location.origin}/new`);
  };

  // A copy of the open document into the person's own: the index makes it and has this app copy the content, then the
  // editor opens it.
  const makeCopy = async () => {
    if (!documentId || copying) return;
    setCopying(true);
    try {
      const share = sessionShareCode
        ? { code: sessionShareCode, password: getSessionSharePassword() }
        : null;
      const { item } = await indexClient.copyItem(documentId, {}, share);
      track('Document', 'Duplicated', 'Copy');
      window.location.assign(`${window.location.origin}/document/${encodeURIComponent(item.id)}`);
    } catch {
      // Let the person try again.
      setCopying(false);
      toast.error(DOCUMENT_FAILURE.duplicate(documentName));
    }
  };

  // The command palette's Delete Document, as every delete (docs/specs/013-workspace/trash.md "Deleting"): nothing is
  // asked, the document stops saving and goes to the Trash, and the Explorer offers the Undo. Another document's id (none
  // today) goes the same way without leaving.
  const deleteDocument = async (id: string) => {
    const ok =
      id === documentId
        ? await trashOpenDocument(id, documentName)
        : await indexClient.deleteItem(id).then(
            () => (track('Document', 'Deleted'), true),
            () => false,
          );
    if (!ok) toast.error(DOCUMENT_FAILURE.delete(id === documentId ? documentName : undefined));
  };

  return { newDocument, openDocument, makeCopy, deleteDocument };
}
}
