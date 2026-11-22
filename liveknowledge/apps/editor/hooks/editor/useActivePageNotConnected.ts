// The open page is always a page (docs/specs/030-knowledgebase/links-and-embeds.md "Connected files in the sidebar":
// "A row is never the open page"). A connected row is pressed to open its file in a new browser tab, never opened in
// the knowledgebase; but a load, a delete beside it, an undo or a peer's reorder could still land the open page on
// one (the first tab of the list, a tab after the deleted one). When it does, the nearest page below it in the tree
// opens, else the nearest above.
import { useLayoutEffect } from 'react';
import { buildPageTree, isConnectedRow, type TreePage } from '@liveknowledge/document';

/** The page to open in place of the connected row `id`: the next page in tree order, else the one before. */
export function pageInPlaceOf<T extends TreePage>(tabs: readonly T[], id: string): string | null {
  const order: T[] = [];
  const walk = (nodes: ReturnType<typeof buildPageTree<T>>) => {
    for (const node of nodes) {
      order.push(node.page);
      walk(node.children);
    }
  };
  walk(buildPageTree(tabs));
  const at = order.findIndex((t) => t.id === id);
  const after = order.slice(at + 1).find((t) => !isConnectedRow(t));
  if (after) return after.id;
  const before = order
    .slice(0, Math.max(0, at))
    .reverse()
    .find((t) => !isConnectedRow(t));
  return before?.id ?? null;
}

export function useActivePageNotConnected<T extends TreePage>(
  tabs: readonly T[],
  activeId: string,
  setActiveId: (id: string) => void,
): void {
  const active = tabs.find((t) => t.id === activeId);
  const onConnected = active !== undefined && isConnectedRow(active);
  // Before paint, so a connected row is never drawn as the open page.
  useLayoutEffect(() => {
    if (!onConnected) return;
    const page = pageInPlaceOf(tabs, activeId);
    if (page) setActiveId(page);
  }, [onConnected, tabs, activeId, setActiveId]);
}
