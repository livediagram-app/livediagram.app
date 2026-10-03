import { explorerPathFor } from '@/app/explorer/routes';
import type { SelectedNode } from '@/app/explorer/views';

// A row with no documents of its own goes to its Explorer page.
export function openExplorerPage(node: SelectedNode): void {
  window.location.assign(explorerPathFor(node));
}
