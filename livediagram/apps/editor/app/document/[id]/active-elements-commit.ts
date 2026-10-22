// The update an edit of the active tab's elements makes (useEditorState's `commit`), as React applies it: the
// mapper runs on the tab as it is when the update runs, after every update queued before it. Built from the
// last render instead (tabsRef), it wrote an older copy back over a change queued in the same event: a drag's
// landed result (Shift-chaining arrows: the released arrow snapped back to its stub as the next one was added)
// or a peer's op not yet rendered. Pure.
import type { Element, Tab } from '@livediagram/document';

export function activeElementsCommit(
  activeId: string,
  mapElements: (els: Element[]) => Element[],
): (tabs: Tab[]) => Tab[] {
  return (tabs) => {
    const at = tabs.findIndex((t) => t.id === activeId);
    if (at < 0) return tabs;
    const tab = tabs[at]!;
    const elements = mapElements(tab.elements);
    if (elements === tab.elements) return tabs;
    const out = [...tabs];
    out[at] = { ...tab, elements };
    return out;
  };
}
