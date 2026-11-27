// Opens a page of the knowledgebase (the page tree's rows, the breadcrumb): as every tab switch does
// (@liveworkspace/workbench/hooks/editor/useSelectTab), nothing selected or being edited follows to the next page.
// The switch animates the page area alone (page-switch-transition.ts); the tree and the rails stay as they are.
// A page not opened yet this session is fetched first, with the page before still on screen, and the switch runs once
// its content is here: so a page never opens onto the tab loader or an empty column (page-surface.md "Switching
// pages", Work Tracker 1465).
import type { EditorContextValue } from '@/app/document/[id]/EditorContext';
import { startPageSwitch } from '@/components/page-surface/page-switch-transition';
import { leavePageThen } from '@/lib/page-edit/page-edit-store';

/** Longest a page switch waits for the next page's content before switching anyway, onto its loader (ms). */
export const PAGE_FETCH_WAIT_MS = 1500;

// The latest page asked for: a later press while one is fetching wins, and the earlier one never switches.
let wanted = 0;

/** Resolves once the page's content is here, has failed, or the wait has run out. */
function pageReady(editor: EditorContextValue, id: string): Promise<void> | null {
  const { hydrated, loadedTabIds, loadAllTabs } = editor;
  if (!hydrated || !loadedTabIds || !loadAllTabs || loadedTabIds.has(id)) return null;
  return Promise.race([
    loadAllTabs([id]).then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((resolve) => setTimeout(resolve, PAGE_FETCH_WAIT_MS)),
  ]);
}

export function selectPage(editor: EditorContextValue, id: string): void {
  if (id === editor.activeId) return;
  const ask = ++wanted;
  // A page being edited with unsaved changes is saved first, or stays open (leavePageThen).
  leavePageThen(id, () => {
    const change = () => {
      if (ask !== wanted) return;
      startPageSwitch(() => {
        editor.setActiveId(id);
        editor.setSelectedId(null);
        editor.setMultiSelectedIds(new Set());
        editor.setEditingId(null);
        editor.setFormatSourceId(null);
      });
    };
    const ready = pageReady(editor, id);
    if (ready) void ready.then(change);
    else change();
  });
}
