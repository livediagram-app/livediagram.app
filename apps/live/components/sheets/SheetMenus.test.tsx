// @vitest-environment jsdom
// The grid's menus (docs/specs/029-sheets/sheet.md "Cell menu", "Rows and columns", "Filter", "Sort"): the cell menu,
// a header's menu, a filter column's values and condition, and Custom Sort, each acting on the selection.
import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenMenu } from './sheet-controller';
import {
  makeSheet,
  renderSheet,
  stubResizeObserver,
  SHEET_ID,
  type SheetHarness,
} from './sheet-ui-test-utils';
import { SheetMenus } from './SheetMenus';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const clip = vi.hoisted(() => ({
  copyNow: vi.fn(),
  pasteNow: vi.fn(async () => {}),
  pasteSpecial: vi.fn(async () => {}),
}));
vi.mock('./useSheetClipboard', () => ({ useSheetClipboard: () => clip }));

beforeAll(stubResizeObserver);

const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const no = (name: string | RegExp) => expect(screen.queryByRole('button', { name })).toBeNull();
const layout = (h: SheetHarness) => h.store.sheet(SHEET_ID)!.layout;

function show(h: SheetHarness, menu: OpenMenu, opts: { canEdit?: boolean; at?: string } = {}) {
  const view = renderSheet(h, ({ actions }) => <SheetMenus actions={actions} />, opts);
  act(() => h.ctl().setMenu(menu));
  return view;
}

describe('the cell menu', () => {
  let h: SheetHarness;
  beforeEach(async () => {
    h = await makeSheet({ cells: { A1: '1', A2: '2', B1: 'x', B2: 'y' } });
  });
  const cellMenu: OpenMenu = { kind: 'cell', x: 20, y: 20 };
  // A tile inside a category: the category opens first (one at a time), as in the element menu.
  const tile = (section: string, name: string) => {
    const head = btn(section);
    if (head.getAttribute('aria-expanded') !== 'true') fireEvent.click(head);
    return btn(name);
  };

  it('cuts, copies and pastes from its top strip, and pastes specially from Paste Special, closing after each', () => {
    show(h, cellMenu);
    expect(screen.getByRole('dialog', { name: 'Cell menu' })).toBeTruthy();
    for (const [pick, check] of [
      [() => btn('Cut'), () => expect(clip.copyNow).toHaveBeenLastCalledWith(true)],
      [() => btn('Copy'), () => expect(clip.copyNow).toHaveBeenLastCalledWith(false)],
      [() => btn('Paste'), () => expect(clip.pasteNow).toHaveBeenCalledOnce()],
      [
        () => tile('Paste Special', 'Values Only'),
        () => expect(clip.pasteSpecial).toHaveBeenLastCalledWith('values'),
      ],
      [
        () => tile('Paste Special', 'Formatting Only'),
        () => expect(clip.pasteSpecial).toHaveBeenLastCalledWith('formats'),
      ],
    ] as const) {
      fireEvent.click(pick());
      check();
      expect(h.ctl().menu).toBeNull();
      act(() => h.ctl().setMenu(cellMenu));
    }
  });

  it('makes a chart from the cells, closing', () => {
    show(h, cellMenu);
    act(() => h.select('A1:B2'));
    fireEvent.click(tile('Chart', 'Line'));
    expect(h.placeChart).toHaveBeenCalledWith('line-chart', expect.any(Object));
    expect(h.ctl().menu).toBeNull();
    for (const [name, kind] of [
      ['Bar', 'bar-chart'],
      ['Pie', 'pie-chart'],
    ] as const) {
      act(() => h.ctl().setMenu(cellMenu));
      fireEvent.click(tile('Chart', name));
      expect(h.placeChart).toHaveBeenLastCalledWith(kind, expect.any(Object));
    }
  });

  it('shows someone who may not edit only Copy', () => {
    show(h, cellMenu, { canEdit: false });
    no('Cut');
    no('Paste');
    no('Insert');
    no('Clear');
    fireEvent.click(btn('Copy'));
    expect(clip.copyNow).toHaveBeenCalledWith(false);
  });

  it('opens one category at a time', () => {
    show(h, cellMenu);
    no('Row Above');
    fireEvent.click(btn('Insert'));
    expect(btn('Row Above')).toBeTruthy();
    fireEvent.click(btn('Delete'));
    no('Row Above');
    expect(btn('Row')).toBeTruthy();
    fireEvent.click(btn('Delete'));
    no('Row');
  });

  it('inserts and deletes rows and columns at the selection', () => {
    show(h, cellMenu, { at: 'A2' });
    fireEvent.click(tile('Insert', 'Row Above'));
    expect(layout(h).rows).toHaveLength(9);
    expect(h.value('A3')).toBe(2);
    expect(h.announce).toHaveBeenCalledWith('1 row inserted');
    act(() => h.ctl().setMenu(cellMenu));
    fireEvent.click(tile('Delete', 'Row'));
    expect(layout(h).rows).toHaveLength(8);
    expect(h.value('A2')).toBe(2);
    act(() => h.ctl().setMenu(cellMenu));
    fireEvent.click(tile('Insert', 'Column Left'));
    expect(layout(h).cols).toHaveLength(6);
    expect(h.value('B2')).toBe(2);
    act(() => h.ctl().setMenu(cellMenu));
    fireEvent.click(tile('Delete', 'Column'));
    expect(layout(h).cols).toHaveLength(5);
    expect(h.value('A2')).toBe(2);
  });

  it('inserts and deletes cells, shifting their neighbours', () => {
    show(h, cellMenu);
    fireEvent.click(tile('Insert', 'Cells, Shift Right'));
    expect(h.value('B1')).toBe(1);
    expect(h.value('C1')).toBe('x');
    expect(h.value('A1')).toBeNull();
    act(() => h.ctl().setMenu(cellMenu));
    fireEvent.click(tile('Delete', 'Cells, Shift Left'));
    expect(h.value('A1')).toBe(1);
    act(() => h.ctl().setMenu(cellMenu));
    fireEvent.click(tile('Insert', 'Cells, Shift Down'));
    expect(h.value('A2')).toBe(1);
    expect(h.value('A3')).toBe(2);
    act(() => h.ctl().setMenu(cellMenu));
    fireEvent.click(tile('Delete', 'Cells, Shift Up'));
    expect(h.value('A1')).toBe(1);
    expect(h.value('A2')).toBe(2);
  });

  it('clears values and formats, or formats only', async () => {
    h = await makeSheet({
      cells: { A1: '1', B1: 'x' },
      format: { A1: { b: true }, B1: { i: true } },
    });
    show(h, cellMenu);
    fireEvent.click(tile('Clear', 'Formatting'));
    expect(h.cell('A1')?.format).toBeUndefined();
    expect(h.value('A1')).toBe(1);
    act(() => h.select('B1'));
    act(() => h.ctl().setMenu(cellMenu));
    fireEvent.click(tile('Clear', 'Everything'));
    expect(h.cell('B1')).toBeUndefined();
  });

  it('opens Sort Range', () => {
    show(h, cellMenu);
    fireEvent.click(tile('Cells', 'Sort Range…'));
    expect(h.ctl().menu).toEqual({ kind: 'sort' });
    expect(screen.getByRole('dialog', { name: 'Sort range' })).toBeTruthy();
  });

  it('merges at once when nothing is lost, and asks when values would be', () => {
    show(h, cellMenu);
    act(() => h.select('C1:D2'));
    fireEvent.click(tile('Cells', 'Merge Cells'));
    expect(layout(h).merges).toHaveLength(1);
    expect(h.ctl().menu).toBeNull();
    act(() => h.select('A1:B1'));
    act(() => h.ctl().setMenu(cellMenu));
    fireEvent.click(tile('Cells', 'Merge Cells'));
    const ask = screen.getByRole('alertdialog', { name: 'Merge Cells' });
    expect(ask.textContent).toContain('keeps only the top-left value');
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(layout(h).merges).toHaveLength(1);
    fireEvent.click(tile('Cells', 'Merge Cells'));
    fireEvent.click(btn('Merge'));
    expect(layout(h).merges).toHaveLength(2);
    expect(h.value('B1')).toBeNull();
    expect(h.ctl().menu).toBeNull();
  });

  it('closes on Escape and hands focus back to the grid', () => {
    const grid = document.createElement('div');
    grid.tabIndex = 0;
    document.body.appendChild(grid);
    show(h, cellMenu);
    act(() => h.ctl().setGridEl(grid));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(h.ctl().menu).toBeNull();
    expect(document.activeElement).toBe(grid);
    grid.remove();
  });
});

describe('a header menu', () => {
  let h: SheetHarness;
  beforeEach(async () => {
    h = await makeSheet({
      cells: { A1: 'b', A2: 'a', A3: 'c', B1: 'a much longer value than fits', C2: '3' },
    });
  });
  const rowMenu: OpenMenu = { kind: 'header', axis: 'r', index: 1, x: 5, y: 5 };
  const colMenu: OpenMenu = { kind: 'header', axis: 'c', index: 0, x: 5, y: 5 };

  it('names the rows selected, and inserts, deletes, clears and hides them', () => {
    show(h, rowMenu, { at: 'A2:E3' });
    expect(screen.getByRole('dialog', { name: 'Row menu' })).toBeTruthy();
    expect(screen.getByText('Row 2')).toBeTruthy();
    no('Sort A to Z');
    fireEvent.click(btn('Insert 2 Above'));
    expect(layout(h).rows).toHaveLength(10);
    expect(h.value('A4')).toBe('a');
    expect(h.announce).toHaveBeenCalledWith('2 rows inserted');
    act(() => h.ctl().setMenu(rowMenu));
    fireEvent.click(btn('Insert 2 Below'));
    expect(layout(h).rows).toHaveLength(12);
    act(() => h.ctl().setMenu(rowMenu));
    fireEvent.click(btn('Delete 2 Rows'));
    expect(layout(h).rows).toHaveLength(10);
    act(() => h.select('A2:E3'));
    act(() => h.ctl().setMenu(rowMenu));
    fireEvent.click(btn('Hide 2 Rows'));
    expect([...layout(h).hiddenRows!].sort()).toEqual(
      [layout(h).rows[1], layout(h).rows[2]].sort(),
    );
    act(() => h.select('A1:E1'));
    act(() => h.ctl().setMenu({ ...rowMenu, index: 0 }));
    expect(screen.getByText('Row 1')).toBeTruthy();
    fireEvent.click(btn('Delete Row'));
    act(() => h.ctl().setMenu({ ...rowMenu, index: 0 }));
    fireEvent.click(btn('Clear'));
    expect(h.value('A1')).toBeNull();
  });

  it('names the columns selected, sorts by the column, and hides it', () => {
    show(h, colMenu, { at: 'A1:A8' });
    expect(screen.getByRole('dialog', { name: 'Column menu' })).toBeTruthy();
    expect(screen.getByText('Column A')).toBeTruthy();
    fireEvent.click(btn('Sort A to Z'));
    expect([h.value('A1'), h.value('A2'), h.value('A3')]).toEqual(['a', 'b', 'c']);
    act(() => h.ctl().setMenu(colMenu));
    fireEvent.click(btn('Sort Z to A'));
    expect([h.value('A1'), h.value('A2'), h.value('A3')]).toEqual(['c', 'b', 'a']);
    act(() => h.ctl().setMenu(colMenu));
    fireEvent.click(btn('Insert 1 Right'));
    expect(layout(h).cols).toHaveLength(6);
    act(() => h.ctl().setMenu(colMenu));
    fireEvent.click(btn('Insert 1 Left'));
    expect(layout(h).cols).toHaveLength(7);
    act(() => h.select('A1:B8'));
    act(() => h.ctl().setMenu(colMenu));
    fireEvent.click(btn('Hide 2 Columns'));
    expect(layout(h).hiddenCols).toHaveLength(2);
    act(() => h.ctl().setMenu(colMenu));
    fireEvent.click(btn('Delete 2 Columns'));
    expect(layout(h).cols).toHaveLength(5);
  });

  it('fits a column to its data', () => {
    show(h, { ...colMenu, index: 1 }, { at: 'B1:B8' });
    const before = h.ctl().geometry.cols[2]! - h.ctl().geometry.cols[1]!;
    fireEvent.click(btn('Fit to Data'));
    const col = layout(h).cols[1]!;
    expect(layout(h).colSize?.[col]).toBeGreaterThan(before);
    act(() => h.select('A2'));
    act(() => h.ctl().setMenu({ kind: 'header', axis: 'r', index: 1, x: 5, y: 5 }));
    fireEvent.click(btn('Fit to Data'));
    expect(layout(h).rowSize?.[layout(h).rows[1]!]).toBeGreaterThan(0);
  });

  it('resizes to the pixels typed, at least the line’s minimum', () => {
    show(h, colMenu, { at: 'A1:B8' });
    fireEvent.click(btn('Resize…'));
    const field = screen.getByLabelText('Width') as HTMLInputElement;
    expect(Number(field.value)).toBeGreaterThan(0);
    // Only digits, up to four.
    fireEvent.change(field, { target: { value: '1x2' } });
    expect(field.value).toBe('12');
    fireEvent.keyDown(field, { key: 'Enter' });
    const [a, b] = layout(h).cols;
    expect(layout(h).colSize).toMatchObject({ [a!]: 24, [b!]: 24 });
    expect(h.ctl().menu).toBeNull();
    act(() => h.ctl().setMenu(rowMenu));
    fireEvent.click(btn('Resize…'));
    const height = screen.getByLabelText('Height') as HTMLInputElement;
    fireEvent.change(height, { target: { value: '' } });
    // Nothing typed: nothing happens.
    fireEvent.click(btn('OK'));
    expect(h.ctl().menu).not.toBeNull();
    fireEvent.change(height, { target: { value: '99999' } });
    expect(height.value).toBe('9999');
    fireEvent.keyDown(height, { key: 'a' });
    fireEvent.click(btn('OK'));
    expect(layout(h).rowSize?.[layout(h).rows[0]!]).toBe(2000);
  });

  it('opens a row’s Resize at its height', async () => {
    show(h, rowMenu, { at: 'A2' });
    fireEvent.click(btn('Resize…'));
    const height = screen.getByLabelText('Height') as HTMLInputElement;
    expect(Number(height.value)).toBe(
      Math.round(h.ctl().geometry.rows[2]! - h.ctl().geometry.rows[1]!),
    );
    fireEvent.change(height, { target: { value: '5' } });
    fireEvent.click(btn('OK'));
    expect(layout(h).rowSize?.[layout(h).rows[1]!]).toBe(18);
  });

  it('shows someone who may not edit only Copy', () => {
    show(h, colMenu, { canEdit: false });
    no('Insert 1 Left');
    no('Sort A to Z');
    fireEvent.click(btn('Copy'));
    expect(clip.copyNow).toHaveBeenCalledWith(false);
    expect(h.ctl().menu).toBeNull();
  });
});

describe('the filter menu', () => {
  let h: SheetHarness;
  let colA: string;
  beforeEach(async () => {
    h = await makeSheet({
      cells: { A1: 'Fruit', A2: 'apple', A3: 'pear', A4: 'apple', B1: 'n', B2: '1', B5: '9' },
    });
  });
  async function open() {
    let toggle = () => {};
    const view = renderSheet(
      h,
      ({ actions }) => {
        toggle = actions.toggleFilter;
        return <SheetMenus actions={actions} />;
      },
      { at: 'A1:B5' },
    );
    // The filter over A1:B5, as the toolbar's Filter makes it.
    act(() => toggle());
    colA = layout(h).cols[0]!;
    act(() => h.ctl().setMenu({ kind: 'filter', colId: colA, x: 5, y: 5 }));
    return view;
  }
  const box = (name: string) => screen.getByRole('checkbox', { name: new RegExp(`^${name}`) });
  const cond = () => layout(h).filter?.conds[colA];
  const reopen = () => act(() => h.ctl().setMenu({ kind: 'filter', colId: colA, x: 5, y: 5 }));

  it('lists the column’s values with their counts, blanks last, and searches them', async () => {
    await open();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['apple2', 'pear1', '(Blanks)1']);
    fireEvent.change(screen.getByLabelText('Search values'), { target: { value: 'PE' } });
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['pear1']);
  });

  it('keeps the values ticked, and clears the condition when everything is kept', async () => {
    await open();
    fireEvent.click(box('apple'));
    fireEvent.click(btn('OK'));
    expect(cond()?.values?.sort()).toEqual(['', 'pear']);
    expect(h.ctl().menu).toBeNull();
    reopen();
    expect((box('apple') as HTMLInputElement).checked).toBe(false);
    expect((box('pear') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(btn('Select All'));
    fireEvent.click(btn('OK'));
    expect(cond()).toBeUndefined();
    reopen();
    fireEvent.click(btn('Clear'));
    expect((box('pear') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(box('pear'));
    fireEvent.click(btn('OK'));
    expect(cond()).toEqual({ values: ['pear'] });
  });

  it('filters by a condition with one value, two, or none', async () => {
    await open();
    const select = screen.getByLabelText('Condition') as HTMLSelectElement;
    expect(screen.queryByLabelText('Value')).toBeNull();
    fireEvent.change(select, { target: { value: 'contains' } });
    expect(screen.queryByLabelText('And')).toBeNull();
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'pp' } });
    fireEvent.click(btn('OK'));
    expect(cond()).toEqual({ op: 'contains', a: 'pp' });
    reopen();
    expect((screen.getByLabelText('Condition') as HTMLSelectElement).value).toBe('contains');
    expect((screen.getByLabelText('Value') as HTMLInputElement).value).toBe('pp');
    fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'between' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('And'), { target: { value: '5' } });
    fireEvent.click(btn('OK'));
    expect(cond()).toEqual({ op: 'between', a: '1', b: '5' });
    reopen();
    fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'notEmpty' } });
    expect(screen.queryByLabelText('Value')).toBeNull();
    fireEvent.click(btn('OK'));
    // The value typed for the earlier condition goes with it.
    expect(cond()).toEqual({ op: 'notEmpty', a: '1' });
    reopen();
    fireEvent.change(screen.getByLabelText('Condition'), { target: { value: '' } });
    fireEvent.click(btn('OK'));
    expect(cond()).toBeUndefined();
  });

  it('sorts the column, and cancels without a change', async () => {
    await open();
    fireEvent.click(btn('Cancel'));
    expect(h.ctl().menu).toBeNull();
    expect(cond()).toBeUndefined();
    reopen();
    fireEvent.click(btn('Sort Z to A'));
    expect(h.ctl().menu).toBeNull();
    reopen();
    fireEvent.click(btn('Sort A to Z'));
    expect(h.ctl().menu).toBeNull();
    expect(h.announce).toHaveBeenCalledWith('Sorted A to Z');
    // A condition that takes no value, chosen before anything is typed; keys stay in the menu.
    reopen();
    fireEvent.keyDown(screen.getByLabelText('Search values'), { key: 'Delete' });
    expect(h.ctl().menu).not.toBeNull();
    fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'empty' } });
    fireEvent.click(btn('OK'));
    expect(cond()).toEqual({ op: 'empty' });
  });
});

describe('the sort dialog', () => {
  let h: SheetHarness;
  beforeEach(async () => {
    h = await makeSheet({
      cells: {
        A1: 'Name',
        B1: 'Score',
        C1: 'Team',
        A2: 'c',
        B2: '1',
        C2: 'x',
        A3: 'a',
        B3: '3',
        C3: 'y',
        A4: 'b',
        B4: '3',
        C4: 'x',
      },
    });
  });
  const values = (h: SheetHarness, col: string) => [1, 2, 3, 4].map((r) => h.value(`${col}${r}`));

  it('sorts the range by its keys, with a header row', () => {
    const grid = document.createElement('div');
    document.body.appendChild(grid);
    show(h, { kind: 'sort' }, { at: 'A1:C4' });
    act(() => h.ctl().setGridEl(grid));
    const dialog = screen.getByRole('dialog', { name: 'Sort range' });
    expect(within(dialog).getByText('Sort by')).toBeTruthy();
    const columns = () => within(dialog).getAllByLabelText('Column') as HTMLSelectElement[];
    const orders = () => within(dialog).getAllByLabelText('Order') as HTMLSelectElement[];
    expect([...columns()[0]!.options].map((o) => o.text)).toEqual([
      'Column A',
      'Column B',
      'Column C',
    ]);
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.change(columns()[0]!, { target: { value: '1' } });
    fireEvent.change(orders()[0]!, { target: { value: 'z' } });
    fireEvent.click(btn('Add Another Sort Column'));
    expect(within(dialog).getByText('Then by')).toBeTruthy();
    fireEvent.change(orders()[1]!, { target: { value: 'z' } });
    fireEvent.change(orders()[1]!, { target: { value: 'a' } });
    fireEvent.change(columns()[1]!, { target: { value: '0' } });
    fireEvent.click(btn('Sort'));
    expect(values(h, 'A')).toEqual(['Name', 'a', 'b', 'c']);
    expect(values(h, 'B')).toEqual(['Score', 3, 3, 1]);
    expect(h.ctl().menu).toBeNull();
    grid.remove();
  });

  it('sorts without a header row, and cancels', () => {
    show(h, { kind: 'sort' }, { at: 'A2:C4' });
    fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Delete' });
    fireEvent.click(btn('Cancel'));
    expect(h.ctl().menu).toBeNull();
    expect(values(h, 'A')).toEqual(['Name', 'c', 'a', 'b']);
    act(() => h.ctl().setMenu({ kind: 'sort' }));
    fireEvent.click(btn('Sort'));
    expect(values(h, 'A')).toEqual(['Name', 'a', 'b', 'c']);
  });
});
