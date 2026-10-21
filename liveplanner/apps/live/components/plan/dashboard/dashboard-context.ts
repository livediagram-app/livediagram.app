'use client';

// What a Dashboard's rows and slots read (docs/specs/026-plan/plan-tabs.md "Dashboard tab"), handed down once by
// DashboardPage rather than through every row.
import { createContext, useContext } from 'react';
import type { DashboardLayout, Element, Tab } from '@liveplanner/document';
import type { PlanTabActions } from '@/hooks/plan/usePlanTabActions';
import type { FitGuard } from './useFitGuard';

export type DashboardContextValue = {
  // The document's tabs (a Board or Sheet slot draws one of them), and the dashboard tab's elements by id.
  tabs: readonly Tab[];
  elements: ReadonlyMap<string, Element>;
  // An Editor reshapes the dashboard; anyone else only looks and opens.
  canEdit: boolean;
  actions: PlanTabActions;
  openTab: (tabId: string) => void;
  // Where a shown tab's content is (arrived, failed, on its way), and a fetch again for one that failed.
  tabStatus: (tabId: string) => 'loaded' | 'failed' | 'loading';
  retryTab: (tabId: string) => void;
  // Fetch every tab's content not yet here (a figure from a Sheet choosing among all the document's Sheets); the
  // tabs that fail are marked failed (tabStatus), so calling it again is the Retry.
  loadAllTabs?: (() => void) | undefined;
  deleteTab?: (tabId: string) => void;
  releaseSheets?: (sheetIds: readonly string[]) => boolean;
  // A slot's grip pressed: the page carries the slot with the pointer to where it is let go (DashboardPage).
  beginMove?:
    | ((slotId: string, e: { clientX: number; clientY: number; pointerId: number }) => void)
    | undefined;
  // The dashboard's layout (moving a slot from the keyboard finds its neighbour in it).
  layout?: DashboardLayout;
  // What each slot's content needs, and whether a change keeps it looking good (useFitGuard).
  fit?: FitGuard;
  // The slot being moved, drawn faded where it was.
  movingSlotId?: string | null;
};

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const v = useContext(DashboardContext);
  if (!v) throw new Error('useDashboard outside DashboardPage');
  return v;
}

// Where the document's tabs are, together: all arrived, some still on their way, or settled with some failed.
export type TabsState = 'loaded' | 'loading' | 'failed';

export function tabsStateOf(
  tabs: readonly { id: string }[],
  tabStatus: DashboardContextValue['tabStatus'],
): TabsState {
  let failed = false;
  for (const t of tabs) {
    const s = tabStatus(t.id);
    if (s === 'loading') return 'loading';
    if (s === 'failed') failed = true;
  }
  return failed ? 'failed' : 'loaded';
}
