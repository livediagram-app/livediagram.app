// @vitest-environment jsdom
// Rules on the grid (docs/specs/029-sheets/data-validation.md "Drawing", "Using a dropdown", "Using a checkbox";
// conditional-formatting.md; sheet.md "Paint Format"): chips, boxes and invalid marks drawn, presses and keys that
// pick and tick, what typing is refused or offered, format rules drawn, Paint Format, and each share role.
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FormatRule, ValidationRule } from '@liveplanner/sheets';
import { cellPoint, installGridDom, mountGrid, type MountOptions } from '../sheet-grid-test-utils';

let restore: () => void;
beforeEach(() => {
  restore = installGridDom();
});
afterEach(() => {
  cleanup();
  restore();
});

const LIST: ValidationRule = {
  id: 'rule01',
  r1: 'row1',
  c1: 'col2',
  r2: 'row8',
  c2: 'col2',
  is: 'list',
  opts: [{ v: 'To Do' }, { v: 'Doing', c: '#fde68a' }, { v: 'Done' }],
};
const CHECK: ValidationRule = {
  id: 'rule02',
  r1: 'row1',
  c1: 'col1',
  r2: 'row8',
  c2: 'col1',
  is: 'check',
};
const RED: FormatRule = {
  id: 'frule1',
  r1: 'row1',
  c1: 'col3',
  r2: 'row8',
  c2: 'col3',
  is: 'when',
  op: 'gt',
  a: '10',
  style: { bg: '#ff0000' },
};

const mount = (o: MountOptions = {}) =>
  mountGrid({
    cells: { B2: 'TRUE', B3: 'FALSE', B4: 'maybe', C2: 'Doing', C3: 'Nope', D2: '20', D3: '5' },
    layout: { rules: [LIST, CHECK], formatRules: [RED] },
    ...o,
  });
// What a cell holds now, in the store's view (the fake api never answers, so writes stay pending there).
type Mounted = Awaited<ReturnType<typeof mountGrid>>;
const at = (h: Mounted, r: number, c: number) => {
  const sheet = h.store.sheet(h.sheetId)!;
  return sheet.cells.get(`${sheet.layout.rows[r]}:${sheet.layout.cols[c]}`);
};

describe('drawing', () => {
  it('draws chips in their option colour, boxes ticked for TRUE, invalid marks, and met format rules', async () => {
    const h = await mount();
    const text = h.container.textContent ?? '';
    expect(text).toContain('Doing');
    // A chip in Doing's colour, an unticked box beside a ticked one, a red mark on C3 (Nope) and B4 (maybe).
    const coloured = [...h.container.querySelectorAll<HTMLElement>('.rounded-full')].filter(
      (el) => el.style.backgroundColor === 'rgb(253, 230, 138)',
    );
    expect(coloured.length).toBe(1);
    const boxes = [...h.container.querySelectorAll<HTMLElement>('.rounded-\\[3px\\]')];
    expect(boxes.length).toBe(7);
    expect(boxes.filter((b) => b.querySelector('svg')).length).toBe(1);
    const marks = [...h.container.querySelectorAll<HTMLElement>('div')].filter((el) =>
      el.style.borderTop.includes('rgb(220, 38, 38)'),
    );
    expect(marks.length).toBe(2);
    const red = [...h.container.querySelectorAll<HTMLElement>('div')].filter(
      (el) => el.style.backgroundColor === 'rgb(255, 0, 0)',
    );
    expect(red.length).toBe(1);
  });
  it('says why on hovering an invalid value', async () => {
    const h = await mount();
    fireEvent.pointerMove(h.viewport, cellPoint(2, 2));
    expect(screen.getByText(/^Invalid: Choose one of the dropdown's options/)).toBeTruthy();
  });
  it('draws the format rule being edited, for its editor alone', async () => {
    const h = await mount({ layout: {} });
    act(() => h.c().rules.setFormatPreview({ ...RED, op: 'gt', a: '1' }));
    const red = [...h.container.querySelectorAll<HTMLElement>('div')].filter(
      (el) => el.style.backgroundColor === 'rgb(255, 0, 0)',
    );
    expect(red.length).toBe(2);
    expect(h.writes).toEqual([]);
  });
});

describe('checkboxes', () => {
  it('toggle on a press of the box, and on Space across the selection', async () => {
    const h = await mount();
    fireEvent.pointerDown(h.viewport, { button: 0, ...cellPoint(2, 1) });
    fireEvent.pointerUp(window, cellPoint(2, 1));
    expect(at(h, 2, 1)?.input).toEqual({ b: true });
    act(() =>
      h.c().setSelection({
        ranges: [{ r1: 1, c1: 1, r2: 2, c2: 1 }],
        active: { r: 1, c: 1 },
        anchor: { r: 1, c: 1 },
      }),
    );
    fireEvent.keyDown(h.grid, { key: ' ', code: 'Space' });
    fireEvent.keyUp(h.grid, { key: ' ', code: 'Space' });
    // B2 was TRUE and B3 is now TRUE too: all ticked, so Space unticks both.
    expect([at(h, 1, 1)?.input, at(h, 2, 1)?.input]).toEqual([{ b: false }, { b: false }]);
  });
  it('Space on a cell that is not a box types a space', async () => {
    const h = await mount();
    act(() =>
      h.c().setSelection({
        ranges: [{ r1: 5, c1: 5, r2: 5, c2: 5 }],
        active: { r: 5, c: 5 },
        anchor: { r: 5, c: 5 },
      }),
    );
    fireEvent.keyDown(h.grid, { key: ' ', code: 'Space' });
    fireEvent.keyUp(h.grid, { key: ' ', code: 'Space' });
    expect(h.c().editing?.draft).toBe(' ');
  });
  it('a Participant ticks them; a Viewer only selects', async () => {
    const viewer = await mount({ canEdit: false });
    fireEvent.pointerDown(viewer.viewport, { button: 0, ...cellPoint(2, 1) });
    fireEvent.pointerUp(window, cellPoint(2, 1));
    expect(viewer.writes).toEqual([]);
    expect(viewer.c().selection.active).toEqual({ r: 2, c: 1 });
  });
});

describe('dropdowns', () => {
  it('open on a press of the chip and on Alt+Down, and write the option picked or Clear', async () => {
    const h = await mount();
    fireEvent.pointerDown(h.viewport, {
      button: 0,
      clientX: cellPoint(1, 2).clientX - 30,
      clientY: cellPoint(1, 2).clientY,
    });
    expect(h.c().rules.dropdown).toEqual({ r: 1, c: 2 });
    const list = await screen.findByRole('dialog', { name: 'Options for C2' });
    fireEvent.click(within(list).getByText('Done'));
    expect(at(h, 1, 2)?.input).toEqual({ s: 'Done' });
    expect(h.c().rules.dropdown).toBeNull();
    act(() =>
      h.c().setSelection({
        ranges: [{ r1: 2, c1: 2, r2: 2, c2: 2 }],
        active: { r: 2, c: 2 },
        anchor: { r: 2, c: 2 },
      }),
    );
    fireEvent.keyDown(h.grid, { key: 'ArrowDown', altKey: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Clear' }));
    expect(at(h, 2, 2)?.input).toBeUndefined();
  });
  it('do not open for a Viewer, or on a cell without a dropdown', async () => {
    const viewer = await mount({ canEdit: false });
    expect(viewer.actions().openDropdown({ r: 1, c: 2 })).toBe(false);
    const h = await mount();
    expect(h.actions().openDropdown({ r: 1, c: 0 })).toBe(false);
  });
  it('an Arrow or Plain Text dropdown opens from its arrow', async () => {
    const h = await mount({ layout: { rules: [{ ...LIST, show: 'plain' }] } });
    act(() =>
      h.c().setSelection({
        ranges: [{ r1: 1, c1: 2, r2: 1, c2: 2 }],
        active: { r: 1, c: 2 },
        anchor: { r: 1, c: 2 },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Options for C2' }));
    expect(h.c().rules.dropdown).toEqual({ r: 1, c: 2 });
  });
});

describe('typing in a ruled cell', () => {
  it('refuses a value a Reject rule does not allow, keeping the edit and saying why', async () => {
    const h = await mount();
    act(() =>
      h.c().setSelection({
        ranges: [{ r1: 4, c1: 2, r2: 4, c2: 2 }],
        active: { r: 4, c: 2 },
        anchor: { r: 4, c: 2 },
      }),
    );
    act(() => h.actions().startEdit('type', 'Blocked'));
    let r: ReturnType<ReturnType<typeof h.actions>['commitEdit']> | undefined;
    act(() => {
      r = h.actions().commitEdit('down');
    });
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/To Do, Doing, Done/) });
    expect(h.writes).toEqual([]);
  });
  it('offers the matching options under the editor; Enter saves the one highlighted', async () => {
    const h = await mount();
    act(() =>
      h.c().setSelection({
        ranges: [{ r1: 4, c1: 2, r2: 4, c2: 2 }],
        active: { r: 4, c: 2 },
        anchor: { r: 4, c: 2 },
      }),
    );
    act(() => h.actions().startEdit('type', 'do'));
    const list = await screen.findByRole('listbox', { name: 'Options' });
    expect([...list.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Doing',
      'Done',
      'To Do',
    ]);
    const editor = screen.getByRole('textbox', { name: 'Edit cell C5' });
    fireEvent.keyDown(editor, { key: 'ArrowDown' });
    fireEvent.keyDown(editor, { key: 'Enter' });
    expect(at(h, 4, 2)?.input).toEqual({ s: 'Done' });
  });
  it('Escape closes the options and keeps the typing', async () => {
    const h = await mount();
    act(() =>
      h.c().setSelection({
        ranges: [{ r1: 4, c1: 2, r2: 4, c2: 2 }],
        active: { r: 4, c: 2 },
        anchor: { r: 4, c: 2 },
      }),
    );
    act(() => h.actions().startEdit('type', 'do'));
    const editor = await screen.findByRole('textbox', { name: 'Edit cell C5' });
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'Options' })).toBeNull();
    expect(h.c().editing?.draft).toBe('do');
  });
  it('saves a typed option in its own spelling, and a paste a rule refuses says so', async () => {
    const h = await mount();
    act(() =>
      h.c().setSelection({
        ranges: [{ r1: 4, c1: 2, r2: 4, c2: 2 }],
        active: { r: 4, c: 2 },
        anchor: { r: 4, c: 2 },
      }),
    );
    act(() => h.actions().startEdit('type', 'done'));
    act(() => {
      h.actions().commitEdit('none');
    });
    expect(at(h, 4, 2)?.input).toEqual({ s: 'Done' });
    const layout = h.store.sheet(h.sheetId)!.layout;
    const refused = h
      .c()
      .write(
        { kind: 'cells', cells: [{ r: layout.rows[5]!, c: layout.cols[2]!, i: { s: 'Nope' } }] },
        'Paste',
      );
    expect(refused).toBe(false);
    expect(h.toasts.at(-1)).toMatch(/^C6: Choose one of the dropdown's options/);
  });
});

describe('Paint Format', () => {
  it('paints the held formats onto the next selection, then lets go; kept, it stays on', async () => {
    const h = await mount({ layout: {}, formats: { A1: { b: true, bg: '#00ff00' } } });
    act(() =>
      h.c().setSelection({
        ranges: [{ r1: 0, c1: 0, r2: 0, c2: 0 }],
        active: { r: 0, c: 0 },
        anchor: { r: 0, c: 0 },
      }),
    );
    act(() => h.actions().paintStart(false));
    expect(h.c().rules.paint).not.toBeNull();
    fireEvent.pointerDown(h.viewport, { button: 0, ...cellPoint(3, 3) });
    fireEvent.pointerUp(window, cellPoint(3, 3));
    expect(at(h, 3, 3)?.format).toMatchObject({ b: true, bg: '#00ff00' });
    expect(h.c().rules.paint).toBeNull();
    act(() => h.actions().paintStart(true));
    fireEvent.pointerDown(h.viewport, { button: 0, ...cellPoint(4, 4) });
    fireEvent.pointerUp(window, cellPoint(4, 4));
    expect(h.c().rules.paint).not.toBeNull();
    fireEvent.keyDown(h.grid, { key: 'Escape' });
    expect(h.c().rules.paint).toBeNull();
  });
});

describe('long and arrow dropdowns', () => {
  const MANY: ValidationRule = {
    ...LIST,
    show: 'arrow',
    opts: Array.from({ length: 10 }, (_, i) => ({ v: `Option ${i + 1}` })),
  };
  it('an Arrow dropdown keeps room for its arrow and opens from it; over 8 options, a search filters them', async () => {
    const h = await mount({ layout: { rules: [MANY] }, cells: { C2: 'Option 3' } });
    // The arrow sits in the cell's right edge: a press there opens the list.
    const p = cellPoint(1, 2);
    fireEvent.pointerDown(h.viewport, { button: 0, clientX: p.clientX + 45, clientY: p.clientY });
    const list = await screen.findByRole('dialog', { name: 'Options for C2' });
    const search = within(list).getByLabelText('Search options');
    fireEvent.change(search, { target: { value: '1' } });
    expect(within(list).getByText('Option 1')).toBeTruthy();
    expect(within(list).getByText('Option 10')).toBeTruthy();
    expect(within(list).queryByText('Option 2')).toBeNull();
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(within(list).getByText('No options match “zzz”')).toBeTruthy();
    fireEvent.change(search, { target: { value: '10' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(at(h, 1, 2)?.input).toEqual({ s: 'Option 10' });
  });
  it('a press on the left of an Arrow dropdown cell just selects it', async () => {
    const h = await mount({ layout: { rules: [MANY] } });
    const p = cellPoint(1, 2);
    fireEvent.pointerDown(h.viewport, { button: 0, clientX: p.clientX - 40, clientY: p.clientY });
    fireEvent.pointerUp(window, p);
    expect(h.c().rules.dropdown).toBeNull();
  });
});
