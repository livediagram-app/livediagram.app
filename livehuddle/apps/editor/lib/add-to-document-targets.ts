import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';

// The documents the tab menu's Add to Document offers (docs/specs/006-document/tab-document-many-to-many.md).
// Linking is a server-side row insert that only the document's owner may make, so the list is empty, which
// disables the row, whenever the call could only fail:
//   - an offline document, whose tabs live in this browser only (docs/specs/006-document/offline-mode.md);
//   - a workbench, which reaches its one document only;
//   - a document you don't own (an Editor on someone else's link): the api refuses a tab that lives in no
//     document of yours.
// Offline documents are never destinations either.
export function addToDocumentTargets<D extends { id: string; ownerId: string }>(input: {
  documentId: string | null;
  documentList: readonly D[];
  isOffline: boolean;
  workbench: boolean;
  isOwner: boolean;
}): D[] {
  if (input.isOffline || input.workbench || !input.isOwner) return [];
  return input.documentList.filter(
    (d) => d.id !== input.documentId && d.ownerId !== OFFLINE_OWNER_ID,
  );
}
