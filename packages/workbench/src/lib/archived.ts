// An archived file in an editor (liveworkspace/docs/specs/004-index/one-explorer.md "Archived"): one its owner put in
// Archived never opens. The index refuses its grant as `archived` (only its owner hears that; anyone else hears it is
// missing), and one kept only in this browser carries the mark in This Browser's list. Either way the editor shows
// its archived card in place of the file, and the card's Change Folder goes back to the Explorer's Archived view,
// which opens Change Folder on it.
import type { App } from '@liveworkspace/index-client';
import { isThisBrowserArchived } from '@liveworkspace/explorer/this-browser';

/** The index's refusal for an archived item, as the held grants remember it. */
export const ARCHIVED_REFUSAL = 'archived';

/** Where the archived card's Change Folder goes: the Explorer's Archived view, opening Change Folder on `id`. */
export function archivedChangeFolderHref(id: string, origin = ''): string {
  return `${origin}/explorer/archived?move=${encodeURIComponent(id)}`;
}

/** Whether this browser holds `id` archived: asked before the editor opens it, so it never does. */
export function archivedInThisBrowser(app: App, id: string | null): boolean {
  return id !== null && isThisBrowserArchived(app, id);
}

/** Whether the index refused `id` because it is archived (`refusal` is the app's held-grants reader). */
export function archivedByIndex(
  id: string | null,
  refusal: (id: string) => string | null,
): boolean {
  return id !== null && refusal(id) === ARCHIVED_REFUSAL;
}
