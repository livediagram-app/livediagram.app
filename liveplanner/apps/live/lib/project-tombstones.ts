// Projects the user has just deleted in this page session, so the
// autosave paths (the 600ms debounce AND the beforeunload keepalive
// beacon) stop writing them back. See useAutosave + useProjectListActions.
//
// The bug this guards: deleting the CURRENTLY-OPEN project navigates away
// to /explorer, and that navigation fires the beforeunload flush — which,
// if the open editor had unsaved edits, re-PUTs the tabs + project meta
// with `keepalive: true` and re-creates the project the DELETE just
// removed. Marking the id here makes both save paths bail before they
// write, so the delete sticks on the first try.
//
// Scope is the page load: it's a plain module-level Set, wiped when the
// page reloads / navigates (a fresh JS context), which is exactly the
// lifetime we want — a deleted project never comes back within the
// session, and ids are unique so a future project can't collide.

const deleted = new Set<string>();

export function markProjectDeleted(id: string): void {
  deleted.add(id);
}

// A restore from the Trash (docs/specs/013-workspace/trash.md) in the same page
// session lets the project be written again.
export function unmarkProjectDeleted(id: string): void {
  deleted.delete(id);
}

export function isProjectDeleted(id: string): boolean {
  return deleted.has(id);
}
