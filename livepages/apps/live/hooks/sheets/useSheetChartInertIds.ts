'use client';

// The canvas's inert ids with the charts that sit in a Sheet on the open tab (docs/specs/029-sheets/sheet.md
// "Charts"): the Sheet draws and handles them, so no click, marquee, Select All or keyboard traversal on the canvas
// picks them. `base` itself back while the tab has none. `chartIds` are those charts alone: the Sheet selects one to
// open its element menu, so the selection keeps them (usePruneInertSelection's `kept`).
import { useMemo } from 'react';
import { sheetDrawnChartIds, type Element } from '@livepages/document';

export function useSheetChartInertIds(
  elements: readonly Element[],
  base: ReadonlySet<string>,
): { inertIds: ReadonlySet<string>; chartIds: ReadonlySet<string> } {
  const chartIds = useMemo(() => sheetDrawnChartIds(elements), [elements]);
  const inertIds = useMemo(
    () => (chartIds.size === 0 ? base : new Set([...base, ...chartIds])),
    [chartIds, base],
  );
  return { inertIds, chartIds };
}
