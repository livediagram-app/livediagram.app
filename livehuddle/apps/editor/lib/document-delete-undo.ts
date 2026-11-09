// Deleting the document open in the editor (docs/specs/013-workspace/trash.md "Deleting"): from the command palette or
// any menu in the Explorer panel. The document is tombstoned first (lib/document-tombstones.ts), so neither the autosave
// debounce nor the unload flush can write it back while it goes to the Trash; then the editor leaves for the
// Explorer, which offers the Undo on arrival. The shared Explorer takes the canvas from its address
// (`?trashed=<id>&title=<name>`, dropped from the address once read).
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import {
  markDocumentDeleted,
  unmarkDocumentDeleted,
} from '@liveworkspace/workbench/lib/document-tombstones';
import { track } from '@/lib/telemetry';
import { explorerHref } from '@liveworkspace/workbench/lib/explorer-href';

/**
 * The open document to the Trash, then to the Explorer with its Undo. Resolves false, with the document writable again,
 * when the index refuses; the caller says so.
 */
export async function trashOpenDocument(
  id: string,
  name: string | null | undefined,
  leave: (href: string) => void = (href) => window.location.assign(href),
): Promise<boolean> {
  markDocumentDeleted(id);
  try {
    await indexClient.deleteItem(id);
  } catch {
    unmarkDocumentDeleted(id);
    return false;
  }
  track('Document', 'Deleted');
  leave(
    explorerHref('', `?${new URLSearchParams({ trashed: id, ...(name ? { title: name } : {}) })}`),
  );
  return true;
}
