// @vitest-environment jsdom
// docs/specs/029-sheets/sheet.md "Charts": a chart its Sheet draws is selected for its element menu directly (the
// canvas's selecting passes it by) and let go when the menu closes; any other element is selected as usual.
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import type { EditorContextMenuState } from '@/components/palette/EditorContextMenu.types';
import { createSelectionStore } from '@/lib/selection-store';
import { useSheetChartMenuSelection } from './useSheetChartMenuSelection';

const range = { r1: 'aaaa', c1: 'bbbb', r2: 'cccc', c2: 'dddd' };
const sheet = { ...createShape('plan-sheet', 0, 0), planSheet: { sheetId: 'sheet0001' } };
const chart = {
  ...createShape('pie-chart', 0, 0),
  chartSource: { sheetId: 'sheet0001', range },
  sheetAnchor: { x: 0, y: 0 },
};
const box = createShape('square', 0, 0);
const elements = [sheet, chart, box] as Element[];

function setup() {
  const store = createSelectionStore();
  const selectElement = vi.fn();
  const { result, rerender } = renderHook(
    ({ menu }: { menu: EditorContextMenuState | null }) =>
      useSheetChartMenuSelection({
        elements,
        contextMenu: menu,
        readSelection: store.get,
        selectElement,
        setSelectedId: store.setSelectedId,
        setMultiSelectedIds: store.setMultiSelectedIds,
      }),
    { initialProps: { menu: null as EditorContextMenuState | null } },
  );
  return { store, selectElement, result, rerender };
}

const menuFor = (elementId: string): EditorContextMenuState => ({
  mode: 'element',
  elementId,
  x: 0,
  y: 0,
});

describe('useSheetChartMenuSelection', () => {
  it('selects a chart its Sheet draws directly, and lets it go when the menu closes', () => {
    const { store, selectElement, result, rerender } = setup();
    result.current(chart.id);
    expect(selectElement).not.toHaveBeenCalled();
    expect(store.get().selectedId).toBe(chart.id);
    rerender({ menu: menuFor(chart.id) });
    expect(store.get().selectedId).toBe(chart.id);
    rerender({ menu: null });
    expect(store.get().selectedId).toBeNull();
  });

  it('leaves a selection that moved on alone', () => {
    const { store, result, rerender } = setup();
    result.current(chart.id);
    rerender({ menu: menuFor(chart.id) });
    store.setSelectedId(box.id);
    rerender({ menu: null });
    expect(store.get().selectedId).toBe(box.id);
  });

  it('selects anything else the usual way', () => {
    const { store, selectElement, result } = setup();
    result.current(box.id);
    expect(selectElement).toHaveBeenCalledWith(box.id);
    expect(store.get().selectedId).toBeNull();
  });
});
