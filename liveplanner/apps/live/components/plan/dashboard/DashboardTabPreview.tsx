'use client';

// A Board or Sheet tab in a Dashboard slot (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): the tab's board or Sheet
// itself, live and worked on in place as on its own tab (cards moved, added and opened, cells edited), at the slot's
// size. Its changes are the board's or Sheet's own, so they land on its tab (usePlanSlice commitOn). The slot's menu
// opens the tab. It is drawn in the Dashboard tab's theme (its colours switched from its own tab's theme as a theme
// switch would, keeping any it was given), only here: its own tab keeps its own.
import { useRef } from 'react';
import {
  switchThemeElement,
  tabKindOf,
  type DashboardTabOf,
  type ShapeElement,
} from '@liveplanner/document';
import { getTheme } from '@/lib/themes';
import { PlanBoardView } from '@/components/plan/PlanBoardView';
import { PlanSheetView } from '@/components/sheets/PlanSheetView';
import { SheetChartsContext, useSheetCharts } from '@/components/sheets/sheet-charts-context';
import { SheetHomeTabContext } from '@/components/sheets/sheet-home-tab';
import { useDashboard } from './dashboard-context';
import { Missing, useBoxSize } from './DashboardSlotContent';
import { DashboardDiagramView } from './DashboardDiagramView';
import { TabWaiting } from './TabWaiting';
import { useCardTheme, useViewerAppearance } from './useCardStyle';

export function DashboardTabPreview({
  slotId,
  tabId,
  of,
}: {
  slotId: string;
  tabId: string;
  // What the slot was given, so a deleted one is named (a slot from before it was recorded says Board).
  of?: DashboardTabOf | undefined;
}) {
  const { tabs, tabStatus, retryTab } = useDashboard();
  const bodyRef = useRef<HTMLDivElement>(null);
  const size = useBoxSize(bodyRef);
  // The canvas's chart view, so the Sheet's charts look here as they do on its tab (sheet.md "Charts").
  const renderChart = useSheetCharts()?.renderChart;
  const dashboardTheme = useCardTheme();
  const appearance = useViewerAppearance();
  const tab = tabs.find((t) => t.id === tabId);
  // One box, measured whatever it shows first: a tab whose content is still on its way reads as a Diagram (no kind
  // yet), so a box only drawn once it is a Board or Sheet would never be measured, and the board never drawn.
  return (
    <div ref={bodyRef} className="relative h-full w-full">
      {body()}
    </div>
  );
  function body() {
    if (!tab)
      return (
        <Missing
          message={
            of === 'sheet'
              ? 'This Sheet was deleted.'
              : of === 'diagram'
                ? 'This Diagram was deleted.'
                : 'This Board was deleted.'
          }
          slotId={slotId}
        />
      );
    // A tab whose content is still on its way is a placeholder with no kind and nothing on it (per-tab-storage.md):
    // it waits as the Board or Sheet the slot was given, not as a Diagram tab's card.
    const waiting = !tab.kind && tab.elements.length === 0 && (of === 'board' || of === 'sheet');
    const kind = waiting ? of : tabKindOf(tab);
    if (kind !== 'board' && kind !== 'sheet')
      return (
        <DashboardDiagramView
          tab={tab}
          status={tabStatus(tab.id)}
          onRetry={() => retryTab(tab.id)}
        />
      );
    const shape = tab.kind === 'sheet' ? 'plan-sheet' : 'plan-board';
    const own = tab.elements.find((e) => e.type === 'shape' && e.shape === shape) as
      ShapeElement | undefined;
    const el = own
      ? (switchThemeElement(own, getTheme(tab.theme, appearance), dashboardTheme) as ShapeElement)
      : undefined;
    return (
      <>
        {!el ? (
          <TabWaiting name={tab.name} status={tabStatus(tab.id)} onRetry={() => retryTab(tab.id)} />
        ) : size ? (
          <div className="absolute inset-0">
            {el.shape === 'plan-sheet' ? (
              // Its charts are on its own tab: drawn as they are, not moved from here (sheet.md "Charts").
              <SheetChartsContext.Provider
                value={{ elements: tab.elements, editable: false, renderChart }}
              >
                {/* Made and loaded on its own tab, never the Dashboard's (a new Sheet tab first drawn here). */}
                <SheetHomeTabContext.Provider value={tab.id}>
                  <PlanSheetView
                    element={{ ...el, x: 0, y: 0, width: size.width, height: size.height }}
                  />
                </SheetHomeTabContext.Provider>
              </SheetChartsContext.Provider>
            ) : (
              <PlanBoardView
                element={{ ...el, x: 0, y: 0, width: size.width, height: size.height }}
              />
            )}
          </div>
        ) : null}
      </>
    );
  }
}
