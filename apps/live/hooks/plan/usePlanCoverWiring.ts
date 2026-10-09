'use client';

// The editor's side of the Plan cover (plan-cover-store.ts): which board or Sheet fills the open tab (rescanned only when the
// tab's elements change) and how many elements the tab holds, published to the store before paint, and the reads
// the editor's own hooks take (the keyboard's covered check, the Plan slice's live elements).
import { useCallback, useLayoutEffect, useMemo, type RefObject } from 'react';
import type { Tab } from '@livediagram/document';
import { fillTabElementOf } from '@/components/plan/fill-tab';
import { isCanvasCovered, setPlanCover } from './plan-cover-store';

export function usePlanCoverWiring({
  activeTab,
  activeId,
  tabsRef,
}: {
  activeTab: Tab;
  activeId: string;
  tabsRef: RefObject<readonly Tab[]>;
}): { canvasCovered: () => boolean; readTabElements: () => Tab['elements'] } {
  const filling = useMemo(() => fillTabElementOf(activeTab.elements), [activeTab.elements]);
  const fillTabId = filling?.id ?? null;
  const fillTabKind = filling?.kind ?? null;
  const tabElementCount = activeTab.elements.length;
  useLayoutEffect(() => {
    setPlanCover({ fillTabId, fillTabKind, tabElementCount });
  }, [fillTabId, fillTabKind, tabElementCount]);
  // Gone with the editor: no cover lingers for the next document.
  useLayoutEffect(
    () => () => setPlanCover({ fillTabId: null, fillTabKind: null, tabElementCount: 0 }),
    [],
  );
  const readTabElements = useCallback(
    () => (tabsRef.current.find((t) => t.id === activeId) ?? activeTab).elements,
    [tabsRef, activeId, activeTab],
  );
  return { canvasCovered: isCanvasCovered, readTabElements };
}
