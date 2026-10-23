import type { AccessLevel } from '@livedesign/api-schema';
import { OFFLINE_OWNER_ID } from './offline/offline-store';

// Where a listed design stands to the reader
// (docs/specs/013-workspace/explorer-structure.md#designs-in-this-browser). A design saved only
// in this browser (Offline Mode) is the reader's own, exactly like one in My Work: Space
// `mine`, owner "You". It just lives somewhere else, which the This Browser pill says.

type DesignSpace = 'mine' | 'team' | 'shared';

type Listed = {
  ownerId: string;
  team?: { id: string; name: string } | null;
  shared?: unknown;
};

export function isInThisBrowser(doc: { ownerId: string }): boolean {
  return doc.ownerId === OFFLINE_OWNER_ID;
}

export function designSpace(doc: Listed): DesignSpace {
  if (doc.shared) return 'shared';
  if (doc.team) return 'team';
  return 'mine';
}

// What the reader may do with a listed design (docs/specs/013-workspace/explorer-details-view.md
// "Access", docs/specs/013-workspace/share-roles.md): their own designs, team designs and
// designs in this browser are theirs to edit; one shared with them is what its link grants.
export function readerAccessOf(doc: { shared?: { role: AccessLevel } | null }): AccessLevel {
  return doc.shared ? doc.shared.role : 'edit';
}
