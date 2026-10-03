import type { DocumentListItem } from '@/lib/api-client';
import { explorerPathFor } from '@/app/explorer/routes';
import type { SelectedNode } from '@/app/explorer/views';

// The panel's root bucket of the reader's own documents, split as the page splits it
// (docs/specs/013-workspace/folders.md#dynamic-synthetic-folders): Unsorted holds what has no
// folder and was made by a person, Generated what an AI tool made and nobody filed yet.
export function splitRootDocuments<D extends DocumentListItem>(
  rootDocuments: readonly D[],
): { unsorted: D[]; generated: D[] } {
  return {
    unsorted: rootDocuments.filter((d) => !d.source),
    generated: rootDocuments.filter((d) => !!d.source),
  };
}

// A row with no documents of its own goes to its Explorer page.
export function openExplorerPage(node: SelectedNode): void {
  window.location.assign(explorerPathFor(node));
}
