// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Sheet Chart": an Editor changes a slot's Sheet Chart from Change Chart in the slot's
// cog; anyone else gets no Change Chart.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSlot, ShapeElement } from '@liveplanner/project';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { SlotSection } from './SlotSection';

vi.mock('./SheetChartSource', () => ({
  SheetChartSource: ({
    initialSheetId,
    onChoose,
  }: {
    initialSheetId: string;
    onChoose: (c: { id: string }) => void;
  }) => (
    <button type="button" onClick={() => onChoose({ id: 'new' })}>
      Picker on {initialSheetId}
    </button>
  ),
}));

afterEach(cleanup);

const chart = {
  id: 'c',
  type: 'shape',
  shape: 'bar-chart',
  chartSource: { sheetId: 'sheetAAAA' },
} as unknown as ShapeElement;
const slot = { id: 's1', span: 6, content: { type: 'element', elementId: 'c' } } as DashboardSlot;

function show(canEdit: boolean) {
  const placeItem = vi.fn();
  const onClose = vi.fn();
  const value = {
    tabs: [],
    elements: new Map([['c', chart]]),
    canEdit,
    actions: { placeItem, setSlotContent: vi.fn(), removeSlot: vi.fn(), changeDashboard: vi.fn() },
    openTab: vi.fn(),
    tabStatus: () => 'loaded',
    retryTab: vi.fn(),
  } as unknown as DashboardContextValue;
  render(
    <DashboardContext.Provider value={value}>
      <SlotSection
        rowId="r"
        slot={slot}
        at={{ slot: 0, row: 0, slots: 2 }}
        open
        onToggle={vi.fn()}
        onClose={onClose}
      />
    </DashboardContext.Provider>,
  );
  return { placeItem, onClose };
}

describe('Change Chart in a Sheet Chart slot’s cog', () => {
  it('replaces the slot’s chart with the one chosen, and closes the cog', () => {
    const { placeItem, onClose } = show(true);
    fireEvent.click(screen.getByRole('button', { name: 'Change Chart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Picker on sheetAAAA' }));
    expect(placeItem).toHaveBeenCalledWith(
      { kind: 'sheet-chart', chart: { id: 'new' } },
      { kind: 'slot', slotId: 's1' },
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('is not offered to a Participant or a Viewer', () => {
    show(false);
    expect(screen.queryByRole('button', { name: 'Change Chart' })).toBeNull();
  });
});
