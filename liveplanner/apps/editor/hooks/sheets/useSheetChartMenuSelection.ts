'use client';

// Selecting a chart its Sheet draws for its element menu (docs/specs/029-sheets/sheet.md "Charts"). Such a chart is
// inert to the canvas's own selecting (a click, a marquee, Select All, selectElement), yet the menu's Style,
// Animation, Collaborate and Tools act on the selection, so the menu selects it directly. When the menu closes the
// chart is let go again, so no canvas key (Delete, an arrow nudge) acts on a chart the canvas does not show.
import { useEffect, useRef } from 'react';
import { sheetDrawnChartIds, type Element } from '@liveplanner/project';
import type { EditorContextMenuState } from '@/components/palette/EditorContextMenu.types';
import type { Selection } from '@liveworkspace/workbench/lib/selection-store';

export function useSheetChartMenuSelection({
  elements,
  contextMenu,
  readSelection,
  selectElement,
  setSelectedId,
  setMultiSelectedIds,
}: {
  elements: readonly Element[];
  contextMenu: EditorContextMenuState | null;
  readSelection: () => Selection;
  selectElement: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
}): (id: string) => void {
  // The chart the open menu was opened for, while it is one its Sheet draws.
  const menuChart = useRef<string | null>(null);
  const menuFor = contextMenu?.mode === 'element' ? contextMenu.elementId : null;
  useEffect(() => {
    const held = menuChart.current;
    if (!held || menuFor === held) return;
    menuChart.current = null;
    const { selectedId, multiSelectedIds } = readSelection();
    if (selectedId === held && multiSelectedIds.size === 0) setSelectedId(null);
  }, [menuFor, readSelection, setSelectedId]);
  return (id) => {
    if (!sheetDrawnChartIds(elements).has(id)) {
      selectElement(id);
      return;
    }
    menuChart.current = id;
    setSelectedId(id);
    setMultiSelectedIds(new Set());
  };
}
