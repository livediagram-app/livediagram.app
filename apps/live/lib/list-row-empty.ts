import type { Tab } from '@livediagram/document';

// Whether the editor's own list row reads as empty after a save (docs/specs/006-document/document-snapshots.md):
// nothing on the first tab, or no tab, as the server list will say. A first tab the editor has not loaded
// is a placeholder whose elements are unknown, so the row keeps what the list last said.
export function emptyAfterSave(
  tabs: readonly Tab[],
  loadedTabIds: ReadonlySet<string>,
  listed: boolean | undefined,
): boolean | undefined {
  const first = tabs[0];
  if (!first) return true;
  if (!loadedTabIds.has(first.id)) return listed;
  return first.elements.length === 0;
}
