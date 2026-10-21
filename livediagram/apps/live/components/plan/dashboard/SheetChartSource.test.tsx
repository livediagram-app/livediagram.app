// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement, Tab } from '@livediagram/document';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { SheetChartSource } from './SheetChartSource';
import type { SheetRead } from './useSheetReader';
import { budgetRead, SHEET_ID } from './sheet-chart-test-sheet';

// docs/specs/026-plan/plan-tabs.md "Sheet Chart": Choose a Chart.
let read: SheetRead = { state: 'none' };
vi.mock('./useSheetReader', async (actual) => ({
  ...(await actual<typeof import('./useSheetReader')>()),
  useSheetRead: (sheetId: string) => (sheetId ? read : { state: 'none' }),
  useSheetStore: () => ({ store: null, version: 0, locale: 'en-GB' }),
}));
afterEach(cleanup);

const range = { r1: 'row0a', c1: 'colAa', r2: 'row2a', c2: 'colBa' };
const sheetTab = {
  id: 'sheet-tab',
  name: 'Budget Tab',
  kind: 'sheet',
  elements: [
    { id: 'sh', type: 'shape', shape: 'plan-sheet', planSheet: { sheetId: SHEET_ID } },
    {
      id: 'c1',
      type: 'shape',
      shape: 'line-chart',
      x: 0,
      y: 0,
      width: 260,
      height: 220,
      chartSource: { sheetId: SHEET_ID, range },
      sheetAnchor: { x: 5, y: 5 },
    },
  ],
} as unknown as Tab;

function show(
  tabs: Tab[] = [sheetTab],
  initialSheetId = '',
  tabStatus: DashboardContextValue['tabStatus'] = () => 'loaded',
) {
  const loadAllTabs = vi.fn();
  const value = {
    tabs,
    elements: new Map(),
    canEdit: true,
    actions: {} as DashboardContextValue['actions'],
    openTab: vi.fn(),
    tabStatus,
    retryTab: vi.fn(),
    loadAllTabs,
  } satisfies DashboardContextValue;
  const onChoose = vi.fn<(c: ShapeElement) => void>();
  const onClose = vi.fn();
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  render(
    <DashboardContext.Provider value={value}>
      <SheetChartSource
        anchor={anchor}
        initialSheetId={initialSheetId}
        onChoose={onChoose}
        onClose={onClose}
      />
    </DashboardContext.Provider>,
  );
  return { onChoose, onClose, loadAllTabs };
}

describe('Choose a Chart', () => {
  it('fetches every tab and says when the document has no sheets', () => {
    const { loadAllTabs } = show([]);
    expect(loadAllTabs).toHaveBeenCalled();
    expect(screen.getByText('No sheets in this document yet.')).toBeTruthy();
  });

  it('says when the tabs failed to load, with a Retry, rather than finding for ever', () => {
    const other = { id: 'x', name: 'Other', elements: [] } as unknown as Tab;
    const { loadAllTabs } = show([other], '', () => 'failed');
    expect(screen.queryByText('Finding this document’s sheets…')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain(
      'Couldn’t load this document’s sheets.',
    );
    loadAllTabs.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(loadAllTabs).toHaveBeenCalled();
  });

  it("offers a sheet's own charts once it is picked, and fills the slot with a copy of one", () => {
    read = budgetRead();
    const { onChoose, onClose } = show();
    expect(screen.queryByText('Its Charts')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Budget Tab/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Line Chart · A1:B3' }));
    const chosen = onChoose.mock.calls[0]![0];
    expect(chosen).toMatchObject({
      shape: 'line-chart',
      chartSource: { sheetId: SHEET_ID, range },
    });
    expect(chosen.id).not.toBe('c1');
    expect(chosen.sheetAnchor).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });

  it('makes a new chart over a typed range, of the type picked, and refuses one not on the sheet', () => {
    read = budgetRead();
    const { onChoose } = show([sheetTab], SHEET_ID);
    const field = screen.getByRole('textbox', { name: 'Range' });
    fireEvent.change(field, { target: { value: 'A1:Z9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Chart' }));
    expect(screen.getByRole('alert').textContent).toBe('Not a range on this sheet');
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: 'A1:B3' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Pie' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Chart' }));
    expect(onChoose.mock.calls[0]![0]).toMatchObject({
      shape: 'pie-chart',
      chartSource: { sheetId: SHEET_ID, range },
    });
  });

  it('says when a sheet has no charts yet', () => {
    read = budgetRead();
    show([{ ...sheetTab, elements: sheetTab.elements.slice(0, 1) }], SHEET_ID);
    // The shared empty state, not a bare line (docs/specs/004-interface-design/empty-states.md).
    expect(screen.getByText('No charts yet').closest('[data-empty-state]')).toBeTruthy();
  });
});
