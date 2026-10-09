// @vitest-environment jsdom
// Setup Sheet (docs/specs/029-sheets/sheet.md "Setup Sheet"): a placed sheet awaiting setup shows the card in place
// of its grid; a start and a look are written as one change; Start Blank and Import CSV end setup; cards found by
// the Cards panel's search become rows.
import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import { track } from '@/lib/telemetry';
import {
  makeSheet,
  renderSheet,
  stubResizeObserver,
  SHEET_ID,
  type SheetHarness,
} from './sheet-ui-test-utils';
import { importType, SheetSetup } from './SheetSetup';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
import { rememberSetupStart } from '@/lib/sheet-seeds';
let plan: unknown;
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));

beforeAll(stubResizeObserver);

const person = { id: 'p', name: 'P', color: '#000000' };
const card = (key: number, title: string, status = 'todo'): Item => ({
  id: `i${key}`,
  type: 'task',
  key,
  rank: 'a',
  fields: { title, status },
  rev: 1,
  createdAt: 0,
  updatedAt: key,
  createdBy: person,
  updatedBy: person,
});

const importCsv = vi.fn();
function show(h: SheetHarness) {
  return renderSheet(h, () => <SheetSetup onImportCsv={importCsv} />, {});
}
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const radio = (name: string | RegExp) => screen.getByRole('radio', { name });
const sheet = (h: SheetHarness) => h.store.sheet(SHEET_ID)!;

describe('Setup Sheet', () => {
  let h: SheetHarness;
  beforeEach(async () => {
    vi.clearAllMocks();
    plan = undefined;
    h = await makeSheet({ cells: {} });
    act(() => {
      h.store.write(
        SHEET_ID,
        { kind: 'layout', changes: [{ k: 'options', setupPending: true }] },
        { undoable: false },
      );
    });
  });

  it('fills a start in a look, as one change, and ends setup', async () => {
    show(h);
    expect(screen.getByRole('heading', { name: 'Setup Sheet' })).toBeTruthy();
    // Without cards, Plan Cards is not offered.
    expect(screen.queryByRole('radio', { name: /Plan Cards/ })).toBeNull();
    fireEvent.click(radio(/Tracker/));
    fireEvent.click(btn('Next: Style'));
    fireEvent.click(radio(/Banded/));
    fireEvent.click(radio(/^Roomy/));
    fireEvent.click(btn(/Create Sheet/));
    await h.store.settle();
    expect(h.cell('A1')).toMatchObject({ input: { s: 'Task' }, format: { b: true } });
    expect(sheet(h).layout).toMatchObject({ frozenRows: 1, rowHeight: 36, colWidth: 160 });
    expect(sheet(h).layout.setupPending).toBeUndefined();
    expect(track).toHaveBeenCalledWith('Sheet', 'Created', 'Tracker');
    expect(h.ctl().selection.active).toEqual({ r: 0, c: 0 });
  });

  it('goes back with nothing lost, and a blank sheet takes sizes but no freeze', async () => {
    show(h);
    fireEvent.click(radio(/Blank/));
    fireEvent.click(btn('Next: Style'));
    expect(screen.queryByRole('switch', { name: /Freeze Header Row/ })).toBeNull();
    fireEvent.click(btn(/Back/));
    expect(radio(/Blank/).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(btn('Next: Style'));
    fireEvent.click(radio(/^Compact/));
    fireEvent.click(btn(/Create Sheet/));
    await h.store.settle();
    expect(sheet(h).cells.size).toBe(0);
    expect(sheet(h).layout).toMatchObject({ colWidth: 100, rowHeight: 24 });
    expect(sheet(h).layout.frozenRows).toBeUndefined();
  });

  it('opens a step in on the start a Start Planning sheet type named', async () => {
    rememberSetupStart(SHEET_ID, 'budget');
    show(h);
    // Straight to Style, the start chosen: one press makes the Budget.
    expect(screen.getByRole('button', { name: /Create Sheet/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Create Sheet/ }));
    expect(h.value('A1')).toBe('Item');
  });

  it('ends setup with Start Blank, and with Import CSV opening the file picker', async () => {
    show(h);
    fireEvent.click(btn('Start Blank'));
    await h.store.settle();
    expect(sheet(h).layout.setupPending).toBeUndefined();
    expect(track).toHaveBeenLastCalledWith('Sheet', 'Created', 'Blank');
    act(() => {
      h.store.write(
        SHEET_ID,
        { kind: 'layout', changes: [{ k: 'options', setupPending: true }] },
        { undoable: false },
      );
    });
    fireEvent.click(radio(/Import CSV/));
    fireEvent.click(btn('Choose File…'));
    expect(importCsv).toHaveBeenCalledOnce();
    expect(track).toHaveBeenLastCalledWith('Sheet', 'Created', 'Csv');
  });

  it('writes the cards found as rows, in the columns chosen', async () => {
    const items = new Map([
      ['i1', card(1, 'Write the brief')],
      ['i2', card(2, 'Ship it', 'done')],
      ['i3', card(3, 'Test the brief')],
    ]);
    plan = {
      items,
      types: ITEM_TYPES,
      statusNames: new Map([
        ['todo', 'To Do'],
        ['done', 'Done'],
      ]),
      statusTypes: new Map(),
    };
    show(h);
    fireEvent.click(radio(/Plan Cards/));
    fireEvent.click(btn('Next: Cards'));
    expect(screen.getByRole('status').textContent).toBe('3 cards');
    fireEvent.change(screen.getByLabelText('Search cards'), {
      target: { value: 'brief' },
    });
    expect(screen.getByRole('status').textContent).toBe('2 cards');
    // Columns: the fields the found cards' types have.
    fireEvent.click(btn('Next: Columns'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Due' }));
    fireEvent.click(btn('Next: Style'));
    fireEvent.click(btn(/Create Sheet/));
    await h.store.settle();
    expect(['A1', 'B1', 'C1', 'D1', 'E1'].map((a) => h.cell(a)?.input)).toEqual([
      { s: 'Number' },
      { s: 'Title' },
      { s: 'Type' },
      { s: 'State' },
      { s: 'Due' },
    ]);
    expect(h.cell('A2')?.input).toEqual({ n: 1 });
    expect(h.cell('B3')?.input).toEqual({ s: 'Test the brief' });
    expect(h.cell('D3')?.input).toEqual({ s: 'To Do' });
    expect(h.cell('A4')).toBeUndefined();
    expect(track).toHaveBeenLastCalledWith('Sheet', 'Created', 'Cards');
    // The rows are a card table, linked to the cards found, for new rows of the import's type.
    const [table] = sheet(h).layout.cardTables!;
    expect(table!.type).toBe('task');
    expect(Object.values(table!.rows)).toEqual(['i1', 'i3']);
    expect(table!.cols.map((c) => c.field)).toEqual(['Number', 'Title', 'Type', 'State', 'Due']);
  });

  it('shows the first ten cards found, by number, to look at only, and how many more', () => {
    plan = {
      items: new Map(
        Array.from({ length: 13 }, (_, i) => [`i${i + 1}`, card(13 - i, `Card ${13 - i}`)]),
      ),
      types: ITEM_TYPES,
      statusNames: new Map([['todo', 'To Do']]),
      statusTypes: new Map(),
    };
    show(h);
    fireEvent.click(radio(/Plan Cards/));
    fireEvent.click(btn('Next: Cards'));
    const list = screen.getByRole('list', { name: 'Cards found' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(10);
    expect(rows[0]!.textContent).toContain('#1');
    expect(rows[0]!.textContent).toContain('Card 1');
    // Nothing in it opens.
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('and 3 more')).toBeTruthy();
    // Card Type is offered even when every card found has the same one.
    fireEvent.click(btn('Add Filter'));
    expect(
      within(screen.getByRole('dialog', { name: 'Add Filter' })).getByRole('button', {
        name: 'Card Type',
      }),
    ).toBeTruthy();
  });

  it('keeps the required columns, and waits for a card to match', () => {
    plan = {
      items: new Map([['i1', card(1, 'One')]]),
      types: ITEM_TYPES,
      statusNames: new Map(),
      statusTypes: new Map(),
    };
    show(h);
    fireEvent.click(radio(/Plan Cards/));
    fireEvent.click(btn('Next: Cards'));
    fireEvent.click(btn('Next: Columns'));
    // Number, Title, Type and State are always there; a field no found card's type has is not offered.
    for (const f of ['Number', 'Title', 'Type', 'State']) {
      const box = screen.getByRole('checkbox', { name: new RegExp(`^${f}`) }) as HTMLButtonElement;
      expect([box.disabled, box.getAttribute('aria-checked')]).toEqual([true, 'true']);
    }
    fireEvent.click(btn(/Back/));
    fireEvent.change(screen.getByLabelText('Search cards'), {
      target: { value: 'zzz' },
    });
    expect(screen.getByRole('status').textContent).toBe('No cards match');
    expect((btn('Next: Columns') as HTMLButtonElement).disabled).toBe(true);
    // Back keeps the choice.
    fireEvent.click(btn(/Back/));
    expect(radio(/Plan Cards/).getAttribute('aria-checked')).toBe('true');
  });

  it('takes the import type from a one-type filter, else the commonest', () => {
    expect(importType([{ type: 'idea' }], [{ by: 'type', key: 'note' }])).toBe('note');
    expect(importType([{ type: 'idea' }, { type: 'task' }, { type: 'idea' }], [])).toBe('idea');
    expect(importType([], [])).toBe('task');
  });

  it('offers the columns the cards found can fill', async () => {
    const { columnsForCards } = await import('./SheetSetupStart');
    const types = [
      {
        ...ITEM_TYPES[1]!,
        id: 'a',
        fields: ['title', 'status', 'due', 'f-size'],
        custom: [{ id: 'f-size', label: 'Size', kind: 'text' as const }],
      },
      { ...ITEM_TYPES[1]!, id: 'b', fields: ['title', 'assignee'] },
    ];
    expect(columnsForCards([{ type: 'a' }], types)).toEqual([
      'Number',
      'Title',
      'Type',
      'State',
      'Due',
      'Size',
    ]);
    expect(columnsForCards([{ type: 'b' }], types)).toEqual([
      'Number',
      'Title',
      'Type',
      'State',
      'Assignee',
    ]);
  });
});
