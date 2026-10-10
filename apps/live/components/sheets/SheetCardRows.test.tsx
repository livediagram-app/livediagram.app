// @vitest-environment jsdom
// A card table's rows on the grid (docs/specs/029-sheets/sheet.md "Card tables"): a draft row's Save and Cancel, Open
// Card, and the dropdown a column with set values offers in the active cell.
import { act, fireEvent, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import type { CardTable } from '@livediagram/sheets';
import {
  makeSheet,
  renderSheet,
  stubResizeObserver,
  SHEET_ID,
  type SheetHarness,
} from './sheet-ui-test-utils';
import { SheetCardRows } from './SheetCardRows';

let plan: Record<string, unknown> | undefined;
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));

beforeAll(stubResizeObserver);

const person = { id: 'p', name: 'Ada', color: '#000000' };
const card: Item = {
  id: 'i1',
  type: 'task',
  key: 1,
  rank: 'a',
  fields: { title: 'Write', status: 'todo' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: person,
  updatedBy: person,
};

describe('card table rows', () => {
  let h: SheetHarness;
  const openItem = vi.fn();
  beforeEach(async () => {
    vi.clearAllMocks();
    h = await makeSheet({
      cells: { A1: 'Title', B1: 'State', C1: 'Due', A2: 'Write', B2: 'To Do' },
    });
    const { rows, cols } = h.store.sheet(SHEET_ID)!.layout;
    const table: CardTable = {
      id: 'tbl1',
      head: rows[0]!,
      cols: [
        { c: cols[0]!, field: 'Title' },
        { c: cols[1]!, field: 'State' },
        { c: cols[2]!, field: 'Due' },
      ],
      rows: { [rows[1]!]: 'i1' },
      type: 'task',
      drafts: [rows[1]!, rows[2]!],
    };
    act(() => {
      h.store.write(
        SHEET_ID,
        { kind: 'layout', changes: [{ k: 'cardTable', id: 'tbl1', table }] },
        { undoable: false },
      );
    });
    plan = {
      items: new Map([['i1', card]]),
      types: ITEM_TYPES,
      statusNames: new Map([
        ['todo', 'To Do'],
        ['done', 'Done'],
      ]),
      people: [person],
      canEdit: true,
      status: 'ready',
      openItem,
      patchItem: vi.fn(async () => true),
      addItem: vi.fn(),
      trashItems: vi.fn(),
    };
  });

  it('offers Save and Cancel on draft rows, Add Card for a new one, and opens a card', () => {
    renderSheet(h, () => <SheetCardRows />);
    expect(screen.getByRole('button', { name: 'Save Card' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add Card' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Cancel Changes' })).toHaveLength(2);
    // Open Card sits on every card row in view, whatever is selected.
    expect(screen.getAllByRole('button', { name: 'Open Card' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Open Card' }));
    expect(openItem).toHaveBeenCalledWith('i1');
    fireEvent.click(screen.getByRole('button', { name: 'Save Card' }));
    expect(plan!.patchItem as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    expect(h.store.sheet(SHEET_ID)!.layout.cardTables![0]!.drafts).toEqual([
      h.store.sheet(SHEET_ID)!.layout.rows[2],
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Changes' }));
    expect(h.store.sheet(SHEET_ID)!.layout.cardTables![0]!.drafts).toBeUndefined();
  });

  it('picks a state from the active cell’s dropdown, and a date from its date field', () => {
    renderSheet(h, () => <SheetCardRows />);
    act(() => h.select('B2'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose State' }));
    expect(screen.getByRole('radio', { name: 'To Do' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Done' }));
    expect(h.cell('B2')?.input).toEqual({ s: 'Done' });
    act(() => h.select('C2'));
    // The arrow opens the system date picker itself: no popover holding a second date field.
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      value: showPicker,
      configurable: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Choose Due' }));
    expect(showPicker).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
    const due = document.querySelector<HTMLInputElement>('input[type="date"]')!;
    // A year typed digit by digit is not a date yet: nothing is written.
    fireEvent.change(due, { target: { value: '0002-10-20' } });
    expect(h.cell('C2')).toBeUndefined();
    // Nor is a day before the serial dates begin.
    fireEvent.change(due, { target: { value: '1850-10-20' } });
    expect(h.cell('C2')).toBeUndefined();
    fireEvent.change(due, { target: { value: '2026-10-20' } });
    expect(h.cell('C2')).toMatchObject({ input: { n: 46315 }, format: { nf: 'date' } });
    delete (HTMLInputElement.prototype as { showPicker?: unknown }).showPicker;
    // A column without set values offers none, and nor does a header.
    act(() => h.select('A2'));
    expect(screen.queryByRole('button', { name: /^Choose/ })).toBeNull();
    act(() => h.select('B1'));
    expect(screen.queryByRole('button', { name: /^Choose/ })).toBeNull();
  });

  it('draws nothing without the plan', () => {
    plan = undefined;
    renderSheet(h, () => <SheetCardRows />);
    expect(screen.queryByRole('button', { name: 'Save Card' })).toBeNull();
  });
});
