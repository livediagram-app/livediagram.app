// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Figures from a Sheet": an Editor changes a figure's source from Change Source in
// the slot's cog (one menu per item, never a hover button); anyone else gets no Change Source.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSlot, SheetMetricContent } from '@livepages/document';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { SlotSection } from './SlotSection';

vi.mock('./SheetMetricSource', () => ({
  SheetMetricSource: ({
    content,
    onChange,
  }: {
    content: SheetMetricContent;
    onChange: (c: SheetMetricContent) => void;
  }) => (
    <button type="button" onClick={() => onChange({ ...content, sheetId: 'other' })}>
      Source of {content.sheetId}
    </button>
  ),
}));
afterEach(cleanup);

const figure = (sheetId: string): DashboardSlot => ({
  id: 's1',
  span: 6,
  content: { type: 'sheet-metric', metric: 'figure', sheetId },
});

function show(slot: DashboardSlot, canEdit: boolean) {
  const setSlotContent = vi.fn();
  const value = {
    tabs: [],
    elements: new Map(),
    canEdit,
    actions: { setSlotContent, placeItem: vi.fn(), removeSlot: vi.fn(), changeDashboard: vi.fn() },
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
        onClose={vi.fn()}
      />
    </DashboardContext.Provider>,
  );
  return setSlotContent;
}

describe('Change Source in a figure’s cog', () => {
  it('opens the source picker on the figure, and its choice changes the slot', () => {
    const setSlotContent = show(figure('sheetAAAA'), true);
    fireEvent.click(screen.getByRole('button', { name: 'Change Source' }));
    fireEvent.click(screen.getByRole('button', { name: 'Source of sheetAAAA' }));
    expect(setSlotContent).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ sheetId: 'other' }),
    );
  });

  it('is not offered before a source is chosen, nor to anyone who may not edit', () => {
    show(figure(''), true);
    expect(screen.queryByRole('button', { name: 'Change Source' })).toBeNull();
    cleanup();
    show(figure('sheetAAAA'), false);
    expect(screen.queryByRole('button', { name: 'Change Source' })).toBeNull();
  });
});
