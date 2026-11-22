// Who may edit a page (docs/specs/030-knowledgebase/editing.md "Share roles"; knowledgebases-and-pages.md "Share
// roles"): an Editor of the knowledgebase, the page loaded and holding writing of its own. A Participant, a Viewer and
// a link visitor read; the room drops their draft frames too (room-op-gate.ts). Pure.

export type PageEditAccess = {
  // The session cannot change the document at all (a Viewer, a view link, a Community visitor).
  isReadOnly: boolean;
  // A Participant: comments and answers, never a page's writing.
  participating: boolean;
  // The page is a connected tab (it holds another item's content) or has not loaded yet.
  connected: boolean;
  loaded: boolean;
};

/** Whether this session may take a page into edit mode. */
export function mayEditPage(a: PageEditAccess): boolean {
  return !a.isReadOnly && !a.participating && !a.connected && a.loaded;
}

/** Whether this session's read lens is locked: someone who could edit is reading. A reader's needs no lock. */
export function readLensLocked(a: Pick<PageEditAccess, 'isReadOnly' | 'participating'>): boolean {
  return !a.isReadOnly && !a.participating;
}
