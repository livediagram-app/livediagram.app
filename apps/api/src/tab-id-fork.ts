// Re-minting seeded tab ids a create must not write into
// (docs/specs/006-document/offline-mode.md, "Shared tabs fork").
//
// A tab id is global, so a seeded tab whose id another document already holds
// would upsert over that tab. The create keeps the content under a fresh id
// instead, and re-points everything inside the new document that named the old
// one: tab / element links in its tabs, and its deck's slides.

import {
  parseStoredPresentation,
  remapPresentationTabs,
  remapTabLinks,
  type Tab,
} from '@livediagram/document';

export function forkTakenTabIds(
  tabs: Tab[],
  presentation: string | null,
  taken: Set<string>,
  mintId: () => string = () => crypto.randomUUID(),
): { tabs: Tab[]; presentation: string | null } {
  const tabIdMap = new Map<string, string>();
  for (const tab of tabs) if (taken.has(tab.id)) tabIdMap.set(tab.id, mintId());
  if (tabIdMap.size === 0) return { tabs, presentation };
  const stored = parseStoredPresentation(presentation);
  return {
    tabs: tabs.map((tab) => ({
      ...tab,
      id: tabIdMap.get(tab.id) ?? tab.id,
      elements: remapTabLinks(tab.elements, tabIdMap),
    })),
    presentation: stored ? JSON.stringify(remapPresentationTabs(stored, tabIdMap)) : presentation,
  };
}
