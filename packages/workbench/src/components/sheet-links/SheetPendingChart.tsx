'use client';

// A chart meant to come from a sheet and not linked yet (each reader app's docs/specs/009-elements/pie-chart.md "Not
// linked yet", Work Tracker 1281), on the canvas: its view faded under a centred chip that says so, as the export draws
// it (svg-render-charts.ts). It reads nothing but the element, so a thumbnail, a read-only view and every role see it
// the same; the chip takes no pointer, so the chart selects and drags as any.
import type { ReactNode } from 'react';
import { SheetLinkIcon } from '@liveworkspace/ui';
import {
  SHEET_PENDING_FADE,
  sheetPendingWords,
} from '@liveworkspace/element-model/chart-sheet-pending';
import { isChart, type SheetLinkElement } from './sheet-links';

/** Whether a chart shows as not linked yet: marked so, and no sheet linked. */
export function isSheetPending(element: SheetLinkElement): boolean {
  return isChart(element) && element.chartSheetPending === true && !element.chartSheetSource;
}

export function SheetPendingChart({
  element,
  children,
}: {
  element: SheetLinkElement & { width: number; height: number };
  children: ReactNode;
}) {
  if (!isSheetPending(element)) return <>{children}</>;
  const words = sheetPendingWords(element.width, element.height);
  return (
    <>
      <div
        data-sheet-pending-fade=""
        className="absolute inset-0"
        style={{ opacity: SHEET_PENDING_FADE }}
      >
        {children}
      </div>
      {words ? (
        <div
          data-sheet-pending=""
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-[22px] items-center gap-1.5 rounded-full border border-slate-300 bg-white/95 pr-2.5 pl-2 text-[11px] leading-none font-medium whitespace-nowrap text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-200">
            <SheetLinkIcon size={11} className="shrink-0 text-slate-500 dark:text-slate-400" />
            <span className="text-optical-centre">{words}</span>
          </span>
        </div>
      ) : null}
    </>
  );
}
