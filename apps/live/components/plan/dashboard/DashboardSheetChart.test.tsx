// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement } from '@livediagram/document';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardSheetChart } from './DashboardSheetChart';

// docs/specs/026-plan/plan-tabs.md "Sheet Chart": drawn live in its slot; an Editor changes it, anyone looks.
const sheetRead = vi.fn((_id: string) => ({ state: 'none' }));
vi.mock('./useSheetReader', () => ({ useSheetRead: (id: string) => sheetRead(id) }));
vi.mock('@/components/sheets/SheetLinkedChart', () => ({
  SheetLinkedChart: ({
    element,
    children,
  }: {
    element: ShapeElement;
    children: (el: ShapeElement) => ReactNode;
  }) => <>{children(element)}</>,
}));
vi.mock('@/components/canvas/DataChartView', () => ({
  DataChartView: ({ element }: { element: ShapeElement }) => (
    <span data-testid="drawn">{`${element.shape} ${element.width}x${element.height}`}</span>
  ),
}));
vi.mock('./SheetChartSource', () => ({
  SheetChartSource: ({
    initialSheetId,
    onChoose,
  }: {
    initialSheetId: string;
    onChoose: (c: ShapeElement) => void;
  }) => (
    <button type="button" onClick={() => onChoose({ id: 'new' } as ShapeElement)}>
      {`Picker on ${initialSheetId}`}
    </button>
  ),
}));
afterEach(cleanup);

const element = {
  id: 'c',
  type: 'shape',
  shape: 'bar-chart',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  chartSource: { sheetId: 'sheetAAAA', range: { r1: 'a', c1: 'b', r2: 'c', c2: 'd' } },
} as ShapeElement;

function show(canEdit: boolean) {
  const placeItem = vi.fn();
  const value = {
    tabs: [],
    elements: new Map(),
    canEdit,
    actions: { placeItem } as unknown as DashboardContextValue['actions'],
    openTab: vi.fn(),
    tabStatus: () => 'loaded' as const,
    retryTab: vi.fn(),
  } satisfies DashboardContextValue;
  render(
    <DashboardContext.Provider value={value}>
      <DashboardSheetChart element={element} />
    </DashboardContext.Provider>,
  );
  return placeItem;
}

describe('a Sheet Chart in a slot', () => {
  it('draws its chart at the slot’s size, asking for its sheet', () => {
    show(false);
    expect(screen.getByTestId('drawn').textContent).toBe('bar-chart 400x300');
    expect(sheetRead).toHaveBeenCalledWith('sheetAAAA');
    expect(screen.getByRole('group', { name: 'Column chart' })).toBeTruthy();
  });

  it('has no Change Chart of its own: it is in the slot’s cog (SlotSection)', () => {
    show(true);
    expect(screen.queryByRole('button', { name: 'Change Chart' })).toBeNull();
  });
});
