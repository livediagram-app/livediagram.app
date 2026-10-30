// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Workbook, cellKey, type Sheet } from '@liveplanner/sheets';
import type { SheetMetricContent } from '@liveplanner/project';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardSheetMetric } from './DashboardSheetMetric';
import type { SheetRead } from './useSheetReader';

// docs/specs/026-plan/plan-tabs.md "Figures from a Sheet".
let read: SheetRead = { state: 'none' };
vi.mock('./useSheetReader', () => ({ useSheetRead: () => read }));
afterEach(cleanup);

const rows = ['row0a', 'row1a', 'row2a', 'row3a'];
const cols = ['colAa', 'colBa'];
function budget(rent = 1200): Extract<SheetRead, { state: 'ready' }> {
  const cell = (s: string | number) => ({ input: typeof s === 'number' ? { n: s } : { s } });
  const cells = new Map([
    [cellKey('row0a', 'colAa'), cell('Item')],
    [cellKey('row0a', 'colBa'), cell('Spent')],
    [cellKey('row1a', 'colAa'), cell('Rent')],
    [cellKey('row1a', 'colBa'), cell(rent)],
    [cellKey('row2a', 'colAa'), cell('Food')],
    [cellKey('row2a', 'colBa'), cell(300)],
    [cellKey('row3a', 'colAa'), cell('Target')],
    [cellKey('row3a', 'colBa'), cell(2000)],
  ]);
  const sheet: Sheet = {
    id: 'sheetAAAA',
    tabId: 't',
    title: 'Budget',
    layout: { rows, cols },
    cells,
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: { id: '', name: '', color: '#000' },
  };
  return {
    state: 'ready',
    sheet,
    wb: new Workbook({ sheets: [sheet], locale: 'en-GB' }),
    locale: 'en-GB',
    version: 1,
  };
}

function show(content: SheetMetricContent, canEdit = true) {
  return render(view(content, canEdit));
}

function view(content: SheetMetricContent, canEdit = true) {
  const value = {
    tabs: [],
    elements: new Map(),
    canEdit,
    actions: { setSlotContent: vi.fn() } as unknown as DashboardContextValue['actions'],
    openTab: vi.fn(),
    tabStatus: () => 'loaded' as const,
    retryTab: vi.fn(),
  } satisfies DashboardContextValue;
  return (
    <DashboardContext.Provider value={value}>
      <DashboardSheetMetric slotId="s" content={content} />
    </DashboardContext.Provider>
  );
}

describe('a figure from a Sheet', () => {
  it('offers an Editor Choose a Sheet until its source is chosen, and tells anyone else it waits', () => {
    read = { state: 'none' };
    show({ type: 'sheet-metric', metric: 'figure', sheetId: '' });
    expect(screen.getByRole('button', { name: 'Choose a Sheet' })).toBeTruthy();
    cleanup();
    show({ type: 'sheet-metric', metric: 'figure', sheetId: '' }, false);
    expect(screen.getByText('Waiting for its sheet.')).toBeTruthy();
  });

  it('shows a cell’s value named by its row, and how far along it is toward a target', () => {
    read = budget();
    show({
      type: 'sheet-metric',
      metric: 'figure',
      sheetId: 'sheetAAAA',
      cell: { r: 'row1a', c: 'colBa' },
      target: { r: 'row3a', c: 'colBa' },
    });
    expect(screen.getByRole('group', { name: /^Rent: 1200 of 2000/ })).toBeTruthy();
    expect(screen.getByText('60%')).toBeTruthy();
  });

  // docs/specs/026-plan/plan-tabs.md "A slot's name".
  it('shows its slot’s own name in place of the row’s, and before a source is chosen', () => {
    read = budget();
    show({
      type: 'sheet-metric',
      metric: 'figure',
      sheetId: 'sheetAAAA',
      cell: { r: 'row1a', c: 'colBa' },
      name: 'Monthly rent',
    });
    expect(screen.getByRole('group', { name: /^Monthly rent: 1200/ })).toBeTruthy();
    expect(screen.queryByText('Rent')).toBeNull();
    cleanup();
    read = { state: 'none' };
    show({ type: 'sheet-metric', metric: 'figure', sheetId: '', name: 'Monthly rent' });
    expect(screen.getByText('Monthly rent')).toBeTruthy();
  });

  // docs/specs/026-plan/board-widgets.md: 100% only once the target is met, never a goal just short of it.
  it('reads 99%, not 100%, just short of its target', () => {
    read = budget(1991);
    show({
      type: 'sheet-metric',
      metric: 'figure',
      sheetId: 'sheetAAAA',
      cell: { r: 'row1a', c: 'colBa' },
      target: { r: 'row3a', c: 'colBa' },
    });
    expect(screen.getByText('99%')).toBeTruthy();
  });

  it('sums a column below its header', () => {
    read = budget();
    show({
      type: 'sheet-metric',
      metric: 'summary',
      sheetId: 'sheetAAAA',
      col: 'colBa',
      stat: 'sum',
    });
    expect(screen.getByRole('group', { name: /^Total of Spent: 3500/ })).toBeTruthy();
  });

  it('reads a trend as the change from the one before', () => {
    read = budget();
    show({ type: 'sheet-metric', metric: 'trend', sheetId: 'sheetAAAA', col: 'colBa' });
    expect(screen.getByText(/▲ 1700 \(567%\)/)).toBeTruthy();
  });

  it('says when its sheet or its cell is gone', () => {
    read = { state: 'gone' };
    show({ type: 'sheet-metric', metric: 'figure', sheetId: 'sheetAAAA' });
    expect(screen.getByText('This sheet was deleted.')).toBeTruthy();
    cleanup();
    read = budget();
    show({
      type: 'sheet-metric',
      metric: 'figure',
      sheetId: 'sheetAAAA',
      cell: { r: 'goneRow', c: 'colBa' },
    });
    expect(screen.getByText('The cell it read was deleted.')).toBeTruthy();
  });
});

// "Figures from a Sheet": the figure is sized to its slot even when it first drew Loading.
describe('a figure that arrives after Loading', () => {
  it('is sized to its slot', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    const content: SheetMetricContent = {
      type: 'sheet-metric',
      metric: 'figure',
      sheetId: 'sheetAAAA',
      cell: { r: 'row1a', c: 'colBa' },
    };
    read = { state: 'loading', name: 'Budget' };
    const { rerender } = show(content);
    expect(screen.getByText('Loading Budget…')).toBeTruthy();
    read = budget();
    rerender(view(content));
    expect(screen.getByText('1200').style.fontSize).toBe('56px');
    vi.restoreAllMocks();
  });

  it('has no Change Source of its own: it lives in the slot’s cog', () => {
    read = budget();
    show({
      type: 'sheet-metric',
      metric: 'figure',
      sheetId: 'sheetAAAA',
      cell: { r: 'row1a', c: 'colBa' },
    });
    expect(screen.queryByRole('button', { name: 'Change Source' })).toBeNull();
  });
});
