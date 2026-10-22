'use client';

// The editor's side of the Plan cover (plan-cover-store.ts): which board or Sheet fills the open tab (rescanned only when the
// tab's elements change), published to the store before paint, and the read the editor's keyboard takes (the covered
// check).
import { useLayoutEffect, useMemo } from 'react';
import { isPlanTabKind, type Tab } from '@livediagram/document';
import { fillTabElementOf } from '@/components/plan/fill-tab';
import { isCanvasCovered, setPlanCover } from './plan-cover-store';
import { planTabEntries, setPlanTabList } from './plan-tab-list-store';
import { setActiveTabName } from '@/hooks/editor/active-tab-name-store';

export function usePlanCoverWiring({
  activeTab,
  tabs,
}: {
  activeTab: Tab;
  // Every tab: its Board and Sheet tabs are published for a Dashboard's Tabs category (plan-tab-list-store).
  tabs?: readonly Tab[];
}): { canvasCovered: () => boolean } {
  const planKind = isPlanTabKind(activeTab.kind) ? activeTab.kind : null;
  const filling = useMemo(
    () => fillTabElementOf(activeTab.elements, planKind ?? undefined, activeTab.dashboard),
    [activeTab.elements, planKind, activeTab.dashboard],
  );
  const fillTabId = filling?.id ?? null;
  const fillTabKind = filling?.kind ?? null;
  useLayoutEffect(() => {
    setPlanCover({ fillTabId, fillTabKind, planKind });
  }, [fillTabId, fillTabKind, planKind]);
  // Gone with the editor: no cover lingers for the next document.
  useLayoutEffect(
    () => () => setPlanCover({ fillTabId: null, fillTabKind: null, planKind: null }),
    [],
  );
  useLayoutEffect(() => {
    if (tabs) setPlanTabList(planTabEntries(tabs));
  }, [tabs]);
  useLayoutEffect(() => () => setPlanTabList([]), []);
  // The open tab's name, for the menu box (active-tab-name-store).
  useLayoutEffect(() => setActiveTabName(activeTab.name), [activeTab.name]);
  useLayoutEffect(() => () => setActiveTabName(''), []);
  return { canvasCovered: isCanvasCovered };
}
