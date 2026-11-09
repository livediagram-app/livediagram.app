// Documents the user has just deleted in this page session, so the
// autosave paths (the 600ms debounce AND the beforeunload keepalive
// beacon) stop writing them back. See useAutosave + useDocumentListActions.
//
// The bug this guards: deleting the CURRENTLY-OPEN document navigates away
// to /explorer, and that navigation fires the beforeunload flush — which,
// if the open editor had unsaved edits, re-PUTs the tabs + document meta
// with `keepalive: true` and re-creates the document the DELETE just
// removed. Marking the id here makes both save paths bail before they
// write, so the delete sticks on the first try.
//
// Scope is the page load: it's a plain module-level Set, wiped when the
// page reloads / navigates (a fresh JS context), which is exactly the
// lifetime we want — a deleted document never comes back within the
// session, and ids are unique so a future document can't collide.

const deleted = new Set<string>();

export function markDocumentDeleted(id: string): void {
  deleted.add(id);
}

// A restore from the Trash (docs/specs/013-workspace/trash.md) in the same page
// session lets the document be written again.
export function unmarkDocumentDeleted(id: string): void {
  deleted.delete(id);
}

export function isDocumentDeleted(id: string): boolean {
  return deleted.has(id);
}
