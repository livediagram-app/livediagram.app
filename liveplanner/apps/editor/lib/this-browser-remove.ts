// Deleting a plan kept only in this browser, from the Explorer panel (docs/specs/006-project/offline-mode.md): nothing
// else holds it, so it goes for good. When it is the plan open in the editor, it is tombstoned first
// (lib/project-tombstones.ts), so neither the autosave debounce nor the unload flush can save it again, and the editor
// leaves for the Explorer once the record is gone, as deleting an open cloud plan does (lib/project-delete-undo.ts).
import { explorerHref } from '@liveworkspace/workbench/lib/explorer-href';
import { offlineDeleteProject } from '@/lib/offline/offline-store';
import { markProjectDeleted } from '@/lib/project-tombstones';

export async function removeThisBrowserPlan(
  id: string,
  openId: string | null | undefined,
  remove: (id: string) => Promise<unknown> = offlineDeleteProject,
  leave: (href: string) => void = (href) => window.location.assign(href),
): Promise<void> {
  const isOpen = id === openId;
  if (isOpen) markProjectDeleted(id);
  await remove(id);
  if (isOpen) leave(explorerHref(''));
}
