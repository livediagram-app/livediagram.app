'use client';

// A Sheet Chart in a Dashboard slot (docs/specs/026-plan/plan-tabs.md "Sheet Chart"): a chart element of the dashboard
// tab, drawn at the slot's size and read live from its Sheet (SheetLinkedChart), its last read while the sheet loads
// or once it is gone. Showing it asks for the sheet's tab, so the read finds it. An Editor changes it from Change
// Chart in the slot's cog (SlotSection); anyone may look.
import { CHART_TYPE_LABELS, chartTypeOf, type ShapeElement } from '@liveplanner/document';
import { DataChartView } from '@/components/canvas/DataChartView';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { SheetLinkedChart } from '@/components/sheets/SheetLinkedChart';
import { planPalette } from '../plan-palette';
import { tabsStateOf, useDashboard } from './dashboard-context';
import { TabWaiting } from './TabWaiting';
import { useSheetRead } from './useSheetReader';

export function DashboardSheetChart({
  element,
}: {
  // The chart at the slot's size.
  element: ShapeElement;
}) {
  const { tabs, tabStatus, loadAllTabs } = useDashboard();
  const sheetId = element.chartSource?.sheetId ?? '';
  // Read for its side: the sheet's tab is fetched, so SheetLinkedChart finds the sheet in the store. A failed fetch
  // says so over the chart's last read, with Retry.
  const read = useSheetRead(sheetId, tabs, tabsStateOf(tabs, tabStatus), loadAllTabs);
  const palette = planPalette(useCanvasSurface(), {});
  return (
    <div
      role="group"
      aria-label={`${CHART_TYPE_LABELS[chartTypeOf(element) ?? 'column']} chart`}
      className="absolute inset-0 overflow-hidden"
    >
      <SheetLinkedChart element={element}>
        {(live) => <DataChartView element={live} textColor={palette.text} />}
      </SheetLinkedChart>
      {read.state === 'failed' ? (
        <div className="absolute inset-x-2 bottom-2 rounded-lg bg-white/95 shadow-sm dark:bg-slate-900/95">
          <TabWaiting name={read.name} status="failed" onRetry={read.retry} />
        </div>
      ) : null}
    </div>
  );
}
