// Applying imported draw.io pages to the diagram's tabs
// (docs/specs/020-import-export/drawio-import.md "Pages become tabs"): the
// first page replaces the active tab, every further page becomes a new tab
// straight after it. Pure, so the hook commits it as ONE undo step.

import type { Tab } from '@livediagram/diagram';
import type { ImportedPage } from '@/lib/drawio/import';
import { mergeImportedTab } from '@/lib/import-merge';

const pageName = (page: ImportedPage, index: number) => page.name.trim() || `Page ${index + 1}`;

export function applyDrawioPages(
  tabs: Tab[],
  activeId: string,
  pages: ImportedPage[],
  createTab: (name: string) => Tab,
): Tab[] {
  const at = tabs.findIndex((t) => t.id === activeId);
  const active = tabs[at];
  if (!active || pages.length === 0) return tabs;
  const multiPage = pages.length > 1;

  const imported = (page: ImportedPage, receiving: Tab): Tab =>
    mergeImportedTab(receiving, {
      id: receiving.id,
      name: receiving.name,
      elements: page.elements,
      ...(page.layers ? { layers: page.layers } : {}),
      ...(page.backgroundColor ? { backgroundColor: page.backgroundColor } : {}),
    });

  const first = imported(pages[0]!, {
    ...active,
    name: multiPage ? pageName(pages[0]!, 0) : active.name,
  });
  // New tabs carry the active tab's look, and its folder so a folder run is
  // not split by the tabs landing inside it (D26).
  const added = pages.slice(1).map((page, i) =>
    imported(page, {
      ...createTab(pageName(page, i + 1)),
      id: page.tabId,
      theme: active.theme,
      font: active.font,
      defaultTextSize: active.defaultTextSize ?? 'sm',
      backgroundPattern: active.backgroundPattern,
      backgroundColor: active.backgroundColor,
      backgroundOpacity: active.backgroundOpacity,
      patternColor: active.patternColor,
      backgroundPatternScale: active.backgroundPatternScale,
      ...(active.folder ? { folder: active.folder } : {}),
    }),
  );
  return [...tabs.slice(0, at), first, ...added, ...tabs.slice(at + 1)];
}
