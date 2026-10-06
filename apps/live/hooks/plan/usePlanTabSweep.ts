'use client';

// Statuses are the document's (docs/specs/026-plan/plan-templates.md "Hand-offs"), but a tab's content
// loads only when it is first opened (docs/specs/006-document/per-tab-storage.md). So once a document is
// in Plan, its other tabs are loaded in the background, once a session, with the search panel's sweep:
// a dashboard tab opened first then reads the phases of the boards beside it. Bounded: a document of
// more than PLAN_SWEEP_MAX_TABS tabs is not swept, and its statuses fill in as tabs are opened.
import { useEffect, useRef } from 'react';

export const PLAN_SWEEP_MAX_TABS = 12;

export function shouldSweepPlanTabs(planNeeded: boolean, tabCount: number): boolean {
  return planNeeded && tabCount > 1 && tabCount <= PLAN_SWEEP_MAX_TABS;
}

export function usePlanTabSweep(
  planNeeded: boolean,
  tabCount: number,
  loadAllTabs: () => Promise<void>,
): void {
  const swept = useRef(false);
  const sweep = shouldSweepPlanTabs(planNeeded, tabCount);
  useEffect(() => {
    if (!sweep || swept.current) return;
    swept.current = true;
    void loadAllTabs();
  }, [sweep, loadAllTabs]);
}
