'use client';

// Old Plan tabs to the Plan kinds (docs/specs/026-plan/plan-tabs.md "Converting old Plan tabs"): when someone who may
// reshape the project opens a Plan tab of the general kind holding only Plan elements, once its content has loaded,
// it converts (lib/plan-tab-conversion.ts) in one change, one undo step, and a toast says so. Once a session per tab:
// an undo keeps it as it was until the project is next opened.
import { useEffect, useRef } from 'react';
import type { Tab } from '@liveplanner/project';
import { convertPlanTab, isConvertiblePlanTab } from '@/lib/plan-tab-conversion';
import { useToast } from '@/hooks/ui/useToast';
import { track } from '@/lib/telemetry';

const PLAN_TAB_CONVERTED_MESSAGE = 'This tab was updated to the new Plan layout.';

export function usePlanTabConversion({
  activeTab,
  loaded,
  canReshape,
  commitTabs,
  createTab,
  markTabLoaded,
}: {
  activeTab: Tab;
  // The tab's content is in place (never convert a placeholder).
  loaded: boolean;
  // An Editor of the whole project.
  canReshape: boolean;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  createTab: (name: string) => Tab;
  markTabLoaded: (id: string) => void;
}): void {
  const toast = useToast();
  const tried = useRef(new Set<string>());
  const convertible = loaded && canReshape && isConvertiblePlanTab(activeTab);
  useEffect(() => {
    if (!convertible || tried.current.has(activeTab.id)) return;
    tried.current.add(activeTab.id);
    const next = convertPlanTab(activeTab, createTab, () => crypto.randomUUID());
    if (!next) return;
    const [self, ...made] = next;
    commitTabs((ts) => {
      const at = ts.findIndex((t) => t.id === self!.id);
      if (at < 0) return ts;
      return [...ts.slice(0, at), ...next, ...ts.slice(at + 1)];
    });
    for (const t of made) markTabLoaded(t.id);
    track('Plan', 'Changed', 'TabConverted');
    toast.info(PLAN_TAB_CONVERTED_MESSAGE);
  }, [convertible, activeTab, commitTabs, createTab, markTabLoaded, toast]);
}
