'use client';

import { useEffect } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { hashCardId } from '@/lib/card-address';
import { isEditorPath } from '@/lib/editor-path';
import { hashTabId, isOverviewHash } from '@/lib/overview-address';

// Back and Forward over the Overview's address (docs/specs/026-plan/plan-overview.md "Its address"). The editor
// writes `#overview` or the tab pin over the current entry (useTabEntryEffects, useCardAddress); only a card adds an
// entry. So an entry the browser walks onto names what to show: `#overview` opens the Overview, a tab pin with no card
// opens that tab (closing the Overview). A card's own entry is useCardAddress's. Not where there is no Overview (an
// embed, a session confined to one tab).
export function useOverviewHistory({
  hydrated,
  activeId,
  overviewOpen,
  tabs,
  showOverview,
  selectTab,
  enabled,
}: {
  hydrated: boolean;
  activeId: string;
  overviewOpen: boolean;
  tabs: readonly { id: string }[];
  showOverview: () => void;
  selectTab: (tabId: string) => void;
  enabled: boolean;
}): void {
  const latest = useLatest({ activeId, overviewOpen, tabs, showOverview, selectTab });
  useEffect(() => {
    if (!hydrated || !enabled) return;
    const onPop = () => {
      if (!isEditorPath(window.location.pathname)) return;
      const hash = window.location.hash;
      const now = latest.current;
      if (isOverviewHash(hash)) {
        if (!now.overviewOpen) now.showOverview();
        return;
      }
      if (hashCardId(hash)) return;
      const tabId = hashTabId(hash);
      if (!tabId || !now.tabs.some((t) => t.id === tabId)) return;
      if (now.overviewOpen || tabId !== now.activeId) now.selectTab(tabId);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [hydrated, enabled, latest]);
}
