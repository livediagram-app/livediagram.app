// @vitest-environment jsdom
// The keys of a cell being edited (docs/specs/029-sheets/sheet.md "Editing", "Writing formulas"): Enter, Tab and
// their Shift forms save and move, Alt+Enter breaks the line, Ctrl/⌘+Enter fills the selection, Escape throws the
// edit away, F4 cycles a reference's $ parts, the function list takes the arrows, Tab and Enter, and typing over a
// cell an arrow ends the edit (or, in a formula, points at a cell).
import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { track } from '@/lib/telemetry';
import { makeSheet, renderSheet, type SheetHarness } from './sheet-ui-test-utils';
import { SheetCellEditor } from './SheetCellEditor';
import type { SheetActions } from './useSheetActions';
import type { FormulaInput } from './useFormulaInput';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

let actions: SheetActions;
let input: FormulaInput;
function show(h: SheetHarness, at = 'B2') {
  return renderSheet(
    h,
    (p) => {
      actions = p.actions;
      input = p.input;
      return <SheetCellEditor input={p.input} />;
    },
    { at },
  );
}
const editor = () => screen.getByRole('textbox') as HTMLTextAreaElement;
const key = (
  k: string,
  mods: Partial<Record<'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey', boolean>> = {},
) => fireEvent.keyDown(editor(), { key: k, ...mods });
const draft = (h: SheetHarness) => h.ctl().editing?.draft;
const active = (h: SheetHarness) => h.ctl().selection.active;

describe('the formula input', () => {
  let h: SheetHarness;
  beforeEach(async () => {
    h = await makeSheet({ cells: { B2: 'old' } });
  });
  const edit = (origin: 'type' | 'cell', text?: string) =>
    act(() => actions.startEdit(origin, text));

  it('saves on Enter and moves down, Shift+Enter up, Tab right, Shift+Tab left', async () => {
    show(h);
    for (const [mods, k, to, text] of [
      [{}, 'Enter', { r: 2, c: 1 }, 'a'],
      [{ shiftKey: true }, 'Enter', { r: 1, c: 1 }, 'b'],
      [{}, 'Tab', { r: 1, c: 2 }, 'c'],
      [{ shiftKey: true }, 'Tab', { r: 1, c: 1 }, 'd'],
    ] as const) {
      edit('type', text);
      key(k, mods);
      expect(h.ctl().editing).toBeNull();
      expect(active(h)).toEqual(to);
    }
    expect([h.value('B3'), h.value('B2'), h.value('C2')]).toEqual(['b', 'c', 'd']);
    // A formula's functions are counted the first time they are saved.
    edit('type', '=SUM(1,2)');
    key('Enter');
    expect(track).toHaveBeenCalledWith('Sheet', 'Used', 'SUM');
    expect(track).toHaveBeenCalledWith('Sheet', 'Changed', 'Formula');
  });

  it('throws the edit away on Escape', () => {
    show(h);
    edit('cell');
    fireEvent.change(editor(), { target: { value: 'new' } });
    key('Escape');
    expect(h.ctl().editing).toBeNull();
    expect(h.value('B2')).toBe('old');
    expect(active(h)).toEqual({ r: 1, c: 1 });
  });

  it('breaks the line at the caret on Alt+Enter', () => {
    show(h);
    edit('cell', 'ab');
    editor().setSelectionRange(1, 1);
    key('Enter', { altKey: true });
    expect(draft(h)).toBe('a\nb');
    key('Enter');
    expect(h.value('B2')).toBe('a\nb');
  });

  it('fills every selected cell on Ctrl+Enter or ⌘+Enter, staying put', () => {
    show(h);
    act(() => h.select('A1:B2', 'A1'));
    edit('type', '5');
    key('Enter', { ctrlKey: true });
    expect([h.value('A1'), h.value('B1'), h.value('A2'), h.value('B2')]).toEqual([5, 5, 5, 5]);
    expect(active(h)).toEqual({ r: 0, c: 0 });
    edit('type', '6');
    key('Enter', { metaKey: true });
    expect(h.value('B2')).toBe(6);
  });

  it('cycles a reference’s $ parts on F4, and leaves anything else', () => {
    show(h);
    edit('cell', '=A1');
    key('F4');
    expect(draft(h)).toBe('=$A$1');
    key('F4');
    expect(draft(h)).toBe('=A$1');
    edit('cell', '=1+2');
    key('F4');
    expect(draft(h)).toBe('=1+2');
  });

  it('ends an edit typed over a cell with an arrow, moving that way', () => {
    show(h);
    edit('type', 'x');
    key('ArrowRight');
    expect(h.ctl().editing).toBeNull();
    expect(h.value('B2')).toBe('x');
    expect(active(h)).toEqual({ r: 1, c: 2 });
  });

  it('leaves the arrows to the caret in an edit begun in the cell', () => {
    show(h);
    edit('cell');
    key('ArrowLeft');
    key('a');
    expect(draft(h)).toBe('old');
    expect(h.ctl().editing).not.toBeNull();
  });

  it('points at cells with the arrows in a formula typed over a cell, Shift growing a range', () => {
    show(h);
    edit('type', '=');
    key('ArrowDown');
    expect(draft(h)).toBe('=B3');
    key('ArrowRight');
    expect(draft(h)).toBe('=C3');
    key('ArrowDown', { shiftKey: true });
    expect(draft(h)).toBe('=C3:C4');
    // Typing ends pointing: the next arrow starts again from the cell being edited.
    fireEvent.change(editor(), { target: { value: '=C3:C4+' } });
    key('ArrowUp');
    expect(draft(h)).toBe('=C3:C4+B1');
    // Shift before any pointing is a plain reference.
    fireEvent.change(editor(), { target: { value: '=C3:C4+B1*' } });
    key('ArrowLeft', { shiftKey: true });
    expect(draft(h)).toBe('=C3:C4+B1*A2');
    key('Enter');
    expect(h.ctl().editing).toBeNull();
    expect(h.cell('B2')?.input).toBeTruthy();
  });

  it('does nothing with an arrow where a formula has no place for a reference', () => {
    show(h);
    edit('type', '=1');
    key('ArrowDown');
    expect(draft(h)).toBe('=1');
    expect(h.ctl().editing).not.toBeNull();
  });

  it('steps through the function list with the arrows and takes one with Enter or Tab', () => {
    show(h);
    edit('type', '=');
    fireEvent.change(editor(), { target: { value: '=COUN', selectionStart: 5 } });
    const names = () =>
      screen.getAllByRole('option').map((o) => o.querySelector('.font-semibold')!.textContent!);
    const picked = () =>
      screen.getAllByRole('option').findIndex((o) => o.getAttribute('aria-selected') === 'true');
    const all = names();
    key('ArrowUp');
    expect(picked()).toBe(all.length - 1);
    key('ArrowDown');
    expect(picked()).toBe(0);
    key('ArrowDown');
    expect(picked()).toBe(1);
    key('Enter');
    expect(draft(h)).toBe(`=${all[1]}(`);
    // Picked one, the list starts from the top again.
    fireEvent.change(editor(), { target: { value: '=MI', selectionStart: 3 } });
    expect(picked()).toBe(0);
    const first = names()[0];
    key('Tab');
    expect(draft(h)).toBe(`=${first}(`);
    expect(h.ctl().editing).not.toBeNull();
  });

  it('saves with Shift+Enter even while the function list is open', () => {
    show(h);
    edit('type', '=');
    fireEvent.change(editor(), { target: { value: '=SUM', selectionStart: 4 } });
    expect(screen.getByRole('listbox')).toBeTruthy();
    key('Enter', { shiftKey: true });
    // Saved as typed (not the listed function taken), moving up.
    expect(h.ctl().editing).toBeNull();
    expect(active(h)).toEqual({ r: 0, c: 1 });
  });

  it('says a draft is too long for a cell', () => {
    show(h);
    edit('type', 'x'.repeat(10_001));
    key('Enter');
    expect(screen.getByRole('alert').textContent).toBe('A cell holds up to 10,000 characters');
  });

  it('ignores keys, changes and picks with no edit or list to take them', () => {
    show(h);
    const stopPropagation = vi.fn();
    act(() =>
      input.onKeyDown({ key: 'Enter', stopPropagation, currentTarget: editorLike() } as never),
    );
    expect(stopPropagation).toHaveBeenCalled();
    act(() => input.onChange({ target: { value: 'x', selectionStart: 1 } } as never));
    expect(h.ctl().editing).toBeNull();
    edit('cell', 'plain');
    act(() => input.accept('SUM', null));
    expect(draft(h)).toBe('plain');
  });

  it('takes a function picked without a field to put the caret in', () => {
    show(h);
    edit('type', '=');
    fireEvent.change(editor(), { target: { value: '=AVERAGEI', selectionStart: 9 } });
    act(() => input.accept('AVERAGEIF', null));
    expect(draft(h)).toBe('=AVERAGEIF(');
  });
});

function editorLike() {
  return document.createElement('textarea');
}
