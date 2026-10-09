// @vitest-environment jsdom
// The formula bar (docs/specs/029-sheets/sheet.md "Formula bar"): the name box selects what is typed in it, and fx
// shows the active cell's input (a spilled cell's greyed and read-only) and edits it as the cell does.
import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSheet, renderSheet, type SheetHarness } from './sheet-ui-test-utils';
import { SheetFormulaBar } from './SheetFormulaBar';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

function show(h: SheetHarness, opts: { canEdit?: boolean; at?: string } = {}) {
  return renderSheet(
    h,
    ({ actions, input }) => <SheetFormulaBar actions={actions} input={input} />,
    opts,
  );
}
const nameBox = () => screen.getByLabelText('Name box') as HTMLInputElement;
const fx = () => screen.getByLabelText('Formula bar') as HTMLTextAreaElement;

describe('the formula bar', () => {
  let h: SheetHarness;
  let grid: HTMLDivElement;
  beforeEach(async () => {
    h = await makeSheet({
      cells: { A1: '=1+1', A2: 'two\nlines', B1: '=SEQUENCE(3)', C1: 'plain' },
    });
    grid = document.createElement('div');
    grid.tabIndex = 0;
    document.body.appendChild(grid);
    return () => grid.remove();
  });
  const withGrid = () => act(() => h.ctl().setGridEl(grid));

  it('names the selection in the name box', () => {
    show(h);
    expect(nameBox().value).toBe('A1');
    act(() => h.select('B2:C3'));
    expect(nameBox().value).toBe('B2:C3');
  });

  it('selects a reference or range typed in the name box', () => {
    show(h);
    withGrid();
    fireEvent.focus(nameBox());
    fireEvent.change(nameBox(), { target: { value: 'b4' } });
    expect(nameBox().value).toBe('b4');
    fireEvent.keyDown(nameBox(), { key: 'Enter' });
    expect(h.ctl().selection.active).toEqual({ r: 3, c: 1 });
    expect(document.activeElement).toBe(grid);
    expect(nameBox().value).toBe('B4');
    fireEvent.focus(nameBox());
    fireEvent.change(nameBox(), { target: { value: 'B4:D6' } });
    fireEvent.keyDown(nameBox(), { key: 'Enter' });
    expect(h.ctl().selection.ranges).toEqual([{ r1: 3, c1: 1, r2: 5, c2: 3 }]);
  });

  it('names the selection with a new name, selects a named range, and says why a name cannot be one', () => {
    show(h, { at: 'C2' });
    withGrid();
    act(() => h.select('B1:B3'));
    const type = (text: string) => {
      fireEvent.focus(nameBox());
      fireEvent.change(nameBox(), { target: { value: text } });
      fireEvent.keyDown(nameBox(), { key: 'Enter' });
    };
    type('Amounts');
    expect(h.store.sheet(h.ctl().sheet.id)!.layout.names).toMatchObject([{ name: 'Amounts' }]);
    // The selection is exactly the named range: the box shows its name.
    expect(nameBox().value).toBe('Amounts');
    act(() => h.select('D5'));
    type('amounts');
    expect(h.ctl().selection.ranges).toEqual([{ r1: 0, c1: 1, r2: 2, c2: 1 }]);
    act(() => h.select('D5'));
    type('true');
    expect(h.toast).toHaveBeenLastCalledWith('TRUE and FALSE cannot be names');
    // A reference past the grid says so (Rate2 reads as a cell, as a formula would read it).
    type('Rate2');
    expect(h.toast).toHaveBeenLastCalledWith('There is no RATE2 on this sheet');
    expect(h.store.sheet(h.ctl().sheet.id)!.layout.names).toHaveLength(1);
  });

  it('ignores what is not a reference on the grid, and restores on Escape or blur', () => {
    show(h, { at: 'C2' });
    withGrid();
    // Enter with nothing typed (the box never focused) stays put.
    fireEvent.keyDown(nameBox(), { key: 'Enter' });
    expect(h.ctl().selection.active).toEqual({ r: 1, c: 2 });
    // Not a reference, and not a name (a name starts with a letter or _).
    for (const text of ['3d', 'Z99', 'A1:A20']) {
      fireEvent.focus(nameBox());
      fireEvent.change(nameBox(), { target: { value: text } });
      fireEvent.keyDown(nameBox(), { key: 'Enter' });
      expect(h.ctl().selection.active).toEqual({ r: 1, c: 2 });
    }
    fireEvent.focus(nameBox());
    fireEvent.change(nameBox(), { target: { value: 'A3' } });
    fireEvent.keyDown(nameBox(), { key: 'Escape' });
    expect(nameBox().value).toBe('C2');
    expect(document.activeElement).toBe(grid);
    fireEvent.focus(nameBox());
    fireEvent.change(nameBox(), { target: { value: 'A3' } });
    fireEvent.keyDown(nameBox(), { key: 'x' });
    fireEvent.blur(nameBox());
    expect(nameBox().value).toBe('C2');
    expect(h.ctl().selection.active).toEqual({ r: 1, c: 2 });
  });

  it('shows the active cell’s input as typed, up to three lines tall', () => {
    show(h);
    expect(fx().value).toBe('=1+1');
    expect(fx().rows).toBe(1);
    act(() => h.select('A2'));
    expect(fx().value).toBe('two\nlines');
    expect(fx().rows).toBe(2);
    act(() => h.select('E8'));
    expect(fx().value).toBe('');
  });

  it('shows a spilled cell’s formula greyed and read-only', () => {
    show(h, { at: 'B2' });
    expect(fx().value).toBe('=SEQUENCE(3)');
    expect(fx().readOnly).toBe(true);
    expect(fx().style.color).not.toBe('');
    fireEvent.focus(fx());
    expect(h.ctl().editing).toBeNull();
    act(() => h.select('B1'));
    expect(fx().readOnly).toBe(false);
    expect(fx().style.color).toBe('');
  });

  it('is read-only for someone who may not edit', () => {
    show(h, { canEdit: false });
    expect(fx().readOnly).toBe(true);
    fireEvent.focus(fx());
    expect(h.ctl().editing).toBeNull();
  });

  it('starts an edit when focused, with the draft coloured, and saves it on Enter', () => {
    show(h, { at: 'C1' });
    withGrid();
    fireEvent.focus(fx());
    expect(h.ctl().editing).toMatchObject({ r: 0, c: 2, origin: 'bar', draft: 'plain' });
    expect(document.activeElement).toBe(fx());
    fireEvent.change(fx(), { target: { value: '=A1*2' } });
    expect(h.ctl().editing?.draft).toBe('=A1*2');
    // The reference shows in its colour in the overlay drawn under the transparent text.
    const ref = screen.getByText('A1');
    expect(ref.tagName).toBe('SPAN');
    expect(ref.style.color).not.toBe('');
    fireEvent.select(fx());
    fireEvent.keyDown(fx(), { key: 'Enter' });
    expect(h.ctl().editing).toBeNull();
    expect(h.value('C1')).toBe(4);
    expect(h.ctl().selection.active).toEqual({ r: 1, c: 2 });
  });

  it('shows the function list and argument hint under it, and why a formula cannot be saved', () => {
    show(h, { at: 'C1' });
    fireEvent.focus(fx());
    fireEvent.change(fx(), { target: { value: '=SUMI', selectionStart: 5 } });
    const list = screen.getByRole('listbox', { name: 'Functions' });
    expect(list.textContent).toContain('SUMIF');
    fireEvent.pointerDown(screen.getByText('SUMIF').closest('li')!);
    expect(h.ctl().editing?.draft).toBe('=SUMIF(');
    act(() => h.ctl().setEditing({ ...h.ctl().editing!, draft: '=1+' }));
    fireEvent.keyDown(fx(), { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).not.toBe('');
    expect(h.ctl().editing).not.toBeNull();
  });

  it('keeps presses and double-clicks to itself', () => {
    const outer = vi.fn();
    renderSheet(h, ({ actions, input }) => (
      <div onPointerDown={outer} onDoubleClick={outer}>
        <SheetFormulaBar actions={actions} input={input} />
      </div>
    ));
    fireEvent.pointerDown(nameBox());
    fireEvent.doubleClick(nameBox());
    expect(outer).not.toHaveBeenCalled();
  });
});
