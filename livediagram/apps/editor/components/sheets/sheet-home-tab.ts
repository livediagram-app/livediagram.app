'use client';

// The tab a Sheet drawn away from its own tab lives on (docs/specs/026-plan/plan-tabs.md "Filling a slot"): a Dashboard
// slot showing a Sheet tab provides that tab's id, so a sheet first drawn there (a new Sheet tab made for the slot) is
// made and loaded on its own tab, never on the Dashboard's. Absent (null) on the canvas: the open tab is its tab.
// Kept tiny and free of the sheet chunk, like sheet-charts-context.
import { createContext, useContext } from 'react';

export const SheetHomeTabContext = createContext<string | null>(null);

export function useSheetHomeTab(): string | null {
  return useContext(SheetHomeTabContext);
}
