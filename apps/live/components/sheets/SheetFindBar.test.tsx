// @vitest-environment jsdom
// Find and Replace (docs/specs/029-sheets/sheet.md "Find"): matches counted and stepped through, highlighted while
// open, Match Case, Match Entire Cell and Also Search Formulas; Replace and Replace All; Escape closes.
import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { track } from '@/lib/telemetry';
import { makeSheet, renderSheet, SHEET_ID, type SheetHarness } from './sheet-ui-test-utils';
import { SheetFindBar } from './SheetFindBar';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

function show(h: SheetHarness, mode: 'find' | 'replace' = 'find') {
  const view = renderSheet(h, ({ c }) => (c.findOpen ? <SheetFindBar /> : null));
  act(() => h.ctl().setFindOpen(mode));
  return view;
}
const find = () => screen.getByLabelText('Find') as HTMLInputElement;
const type = (text: string) => fireEvent.change(find(), { target: { value: text } });
const count = () => find().parentElement!.querySelector('span')!.textContent;
const enter = (shiftKey = false) => fireEvent.keyDown(find(), { key: 'Enter', shiftKey });
const active = (h: SheetHarness) => h.ctl().selection.active;
const btn = (name: string) => screen.getByRole('button', { name });

describe('the find bar', () => {
  let h: SheetHarness;
  beforeEach(async () => {
    h = await makeSheet({
      cells: { A1: 'apple', B2: 'Apple pie', C3: '=1+1', A4: 'apple', D5: '7' },
    });
  });

  it('opens focused, counted in telemetry', () => {
    show(h);
    expect(track).toHaveBeenCalledWith('Sheet', 'Opened', 'Find');
    expect(document.activeElement).toBe(find());
    expect(screen.getByRole('search', { name: 'Find in sheet' })).toBeTruthy();
    expect(count()).toBe('');
  });

  it('counts the matches, highlights them, and steps through them', () => {
    show(h);
    type('apple');
    expect(count()).toBe('0 of 3');
    expect(h.ctl().findHits).toEqual([
      { r: 0, c: 0 },
      { r: 1, c: 1 },
      { r: 3, c: 0 },
    ]);
    // The first Enter goes to the first match.
    enter();
    expect(count()).toBe('1 of 3');
    expect(active(h)).toEqual({ r: 0, c: 0 });
    enter();
    expect(count()).toBe('2 of 3');
    expect(active(h)).toEqual({ r: 1, c: 1 });
    enter(true);
    enter(true);
    // Back past the first is the last.
    expect(count()).toBe('3 of 3');
    expect(active(h)).toEqual({ r: 3, c: 0 });
    fireEvent.click(btn('Next Match'));
    expect(count()).toBe('1 of 3');
    fireEvent.click(btn('Previous Match'));
    expect(count()).toBe('3 of 3');
    // A new query starts again from no match shown.
    type('apple ');
    expect(count()).toBe('0 of 1');
    fireEvent.keyDown(find(), { key: 'a' });
    expect(count()).toBe('0 of 1');
    type('');
    expect(h.ctl().findHits).toEqual([]);
  });

  it('goes to the last match on a first Shift+Enter, and says when nothing matches', () => {
    show(h);
    type('apple');
    enter(true);
    expect(count()).toBe('3 of 3');
    type('zebra');
    expect(count()).toBe('No matches');
    enter();
    expect(active(h)).toEqual({ r: 3, c: 0 });
  });

  it('matches case, the entire cell, and formulas when asked', () => {
    show(h);
    type('Apple');
    expect(count()).toBe('0 of 3');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Match Case' }));
    expect(count()).toBe('0 of 1');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Match Case' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Match Entire Cell' }));
    expect(count()).toBe('0 of 2');
    type('1+1');
    expect(count()).toBe('No matches');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also Search Formulas' }));
    expect(count()).toBe('No matches');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Match Entire Cell' }));
    expect(count()).toBe('0 of 1');
  });

  it('closes on Escape and on Close, clearing the highlights and handing focus back', () => {
    const grid = document.createElement('div');
    grid.tabIndex = 0;
    document.body.appendChild(grid);
    show(h);
    act(() => h.ctl().setGridEl(grid));
    type('apple');
    fireEvent.keyDown(find(), { key: 'Escape' });
    expect(h.ctl().findOpen).toBeNull();
    expect(h.ctl().findHits).toEqual([]);
    expect(document.activeElement).toBe(grid);
    act(() => h.ctl().setFindOpen('find'));
    fireEvent.pointerDown(find());
    fireEvent.click(btn('Close Find'));
    expect(h.ctl().findOpen).toBeNull();
    grid.remove();
  });

  it('shows Replace only in replace mode', () => {
    show(h);
    expect(screen.queryByLabelText('Replace with')).toBeNull();
    act(() => h.ctl().setFindOpen('replace'));
    expect(screen.getByLabelText('Replace with')).toBeTruthy();
  });

  it('replaces one match at a time, moving on to the next', async () => {
    show(h, 'replace');
    type('apple');
    fireEvent.change(screen.getByLabelText('Replace with'), { target: { value: 'pear' } });
    // Before a match is shown, Replace goes to the first one.
    fireEvent.click(btn('Replace'));
    expect(count()).toBe('1 of 3');
    expect(h.value('A1')).toBe('apple');
    fireEvent.click(btn('Replace'));
    expect(h.value('A1')).toBe('pear');
    expect(count()).toBe('1 of 2');
    expect(active(h)).toEqual({ r: 1, c: 1 });
    fireEvent.click(btn('Replace'));
    expect(h.value('B2')).toBe('pear pie');
    expect(active(h)).toEqual({ r: 3, c: 0 });
    fireEvent.click(btn('Replace'));
    expect(h.value('A4')).toBe('pear');
    expect(count()).toBe('No matches');
    await h.store.settle();
    expect(h.writes.map((w) => (w.kind === 'cells' ? w.cells.length : 0))).toEqual([1, 1, 1]);
    expect(track).toHaveBeenCalledWith('Sheet', 'Changed', 'Replace');
  });

  it('replaces the last match from the end of the list, wrapping to the start', () => {
    show(h, 'replace');
    type('apple');
    fireEvent.change(screen.getByLabelText('Replace with'), { target: { value: 'fig' } });
    enter(true);
    expect(active(h)).toEqual({ r: 3, c: 0 });
    fireEvent.click(btn('Replace'));
    expect(h.value('A4')).toBe('fig');
    expect(active(h)).toEqual({ r: 0, c: 0 });
  });

  it('leaves a match by its value alone, as Replace changes inputs only', async () => {
    show(h, 'replace');
    // C3 shows 2 from =1+1; its input has no 2 in it.
    type('2');
    fireEvent.change(screen.getByLabelText('Replace with'), { target: { value: '5' } });
    enter();
    expect(active(h)).toEqual({ r: 2, c: 2 });
    fireEvent.click(btn('Replace'));
    expect(h.value('C3')).toBe(2);
    await h.store.settle();
    expect(h.writes).toEqual([]);
  });

  it('replaces every match at once, saying how many', async () => {
    show(h, 'replace');
    type('apple');
    fireEvent.change(screen.getByLabelText('Replace with'), { target: { value: 'kiwi' } });
    fireEvent.click(btn('Replace All'));
    expect(h.notify).toHaveBeenLastCalledWith('Replaced 3 cells');
    expect([h.value('A1'), h.value('B2'), h.value('A4')]).toEqual(['kiwi', 'kiwi pie', 'kiwi']);
    type('7');
    fireEvent.click(btn('Replace All'));
    expect(h.notify).toHaveBeenLastCalledWith('Replaced 1 cell');
    await h.store.settle();
    const before = h.writes.length;
    type('nothing here');
    fireEvent.click(btn('Replace All'));
    expect(h.notify).toHaveBeenLastCalledWith('Replaced 0 cells');
    await h.store.settle();
    expect(h.writes.length).toBe(before);
    expect(h.store.sheet(SHEET_ID)).toBeTruthy();
  });
});
