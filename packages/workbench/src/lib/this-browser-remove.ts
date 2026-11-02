// Deleting an item kept only in this browser, from the Explorer panel (each product's
// docs/specs/006-*/offline-mode.md): nothing else holds it, so it goes for good. When it is the item open in the
// editor, it is tombstoned first (the editor's lib/*-tombstones.ts), so neither the autosave debounce nor the unload
// flush can save it again, and the editor leaves for the Explorer once the record is gone, as deleting an open cloud
// item does. Without that the editor stayed on a record that no longer exists, every save failing.
import { explorerHref } from './explorer-href';

export type ThisBrowserRemove = {
  /** Removes the item's IndexedDB record (the editor's offlineDelete…). */
  remove: (id: string) => Promise<unknown>;
  /** Marks the id deleted for this page load, so the editor's save paths stop writing it. */
  tombstone: (id: string) => void;
  /** Leaves for the Explorer; a full page load by default, so nothing of the dead item's editor survives. */
  leave?: (href: string) => void;
};

export async function removeThisBrowserItem(
  id: string,
  openId: string | null | undefined,
  { remove, tombstone, leave = (href) => window.location.assign(href) }: ThisBrowserRemove,
): Promise<void> {
  const isOpen = id === openId;
  if (isOpen) tombstone(id);
  await remove(id);
  if (isOpen) leave(explorerHref(''));
}
