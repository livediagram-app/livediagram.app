import type { AccessLevel } from '@livediagram/api-schema';
import { OFFLINE_OWNER_ID } from './offline/offline-store';

// Where a listed document stands to the reader
// (docs/specs/013-workspace/explorer-structure.md#local-only-documents). A document saved only
// in this browser (Offline Mode) is the reader's own, exactly like one in My documents: Space
// `mine`, owner "You". It just lives somewhere else, which the Local only pill says.

export type DocumentSpace = 'mine' | 'team' | 'shared';

type Listed = {
  ownerId: string;
  team?: { id: string; name: string } | null;
  shared?: unknown;
};

export function isLocalOnly(doc: { ownerId: string }): boolean {
  return doc.ownerId === OFFLINE_OWNER_ID;
}

export function documentSpace(doc: Listed): DocumentSpace {
  if (doc.shared) return 'shared';
  if (doc.team) return 'team';
  return 'mine';
}

// What the reader may do with a listed document (docs/specs/013-workspace/explorer-details-view.md
// "Access", docs/specs/013-workspace/share-roles.md): their own documents, team documents and
// documents in this browser are theirs to edit; one shared with them is what its link grants.
export function readerAccessOf(doc: { shared?: { role: AccessLevel } | null }): AccessLevel {
  return doc.shared ? doc.shared.role : 'edit';
}
