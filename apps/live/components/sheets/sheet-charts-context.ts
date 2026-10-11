'use client';

// What a Sheet needs to draw the charts that sit in it (docs/specs/029-sheets/sheet.md "Charts"): the elements of the
// tab it is on (its charts are among them) and the theme's chart palette. The canvas provides the open tab's; a
// Dashboard slot showing another tab's Sheet provides that tab's, not to be changed from there (`editable` false).
// Kept tiny and free of the sheet chunk: the canvas, in the main bundle, provides it.
import { createContext, useContext } from 'react';
import type { Element } from '@livediagram/document';
import type { SheetChartRenderer } from '@/components/canvas/sheet-chart-renderer';

export type SheetChartsValue = {
  elements: readonly Element[];
  chartPalette?: readonly string[] | undefined;
  // The charts are on the open tab, so moving, resizing, deleting and inserting land on them.
  editable: boolean;
  // Draws a chart as the canvas draws it (its style, shadow, animations and indicators), from the canvas around the
  // Sheet. Absent where there is no canvas (a test, an export): the chart view alone draws it.
  renderChart?: SheetChartRenderer | undefined;
};

export const SheetChartsContext = createContext<SheetChartsValue | null>(null);

export function useSheetCharts(): SheetChartsValue | null {
  return useContext(SheetChartsContext);
}

// Insert Chart in a Sheet whose tab is not the open one (a Dashboard slot).
export const OPEN_TAB_TO_CHART = "Open the Sheet's tab to add a chart";
