import { OFFLINE_OWNER_ID } from './offline/offline-store';

// Where a listed project stands to the reader
// (docs/specs/013-workspace/explorer-structure.md#projects-in-this-browser). A project saved only
// in this browser (Offline Mode) is the reader's own, exactly like one in My Work: Space
// `mine`, owner "You". It just lives somewhere else, which the This Browser pill says.

export function isInThisBrowser(doc: { ownerId: string }): boolean {
  return doc.ownerId === OFFLINE_OWNER_ID;
}
