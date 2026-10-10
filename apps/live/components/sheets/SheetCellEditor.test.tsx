// @vitest-environment jsdom
// The in-place cell editor (docs/specs/029-sheets/sheet.md "Editing", "Writing formulas"): over the cell, grown
// with its text, its references coloured, the function list and argument hint under it, and a formula that cannot
// be read underlined with the reason.
import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cellBox, mergeAt } from './sheet-geometry';
import { fontPx } from './SheetCells';
import { makeSheet, renderSheet, type SheetHarness } from './sheet-ui-test-utils';
import { SheetCellEditor } from './SheetCellEditor';
import type { SheetActions } from './useSheetActions';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

let actions: SheetActions;
function show(h: SheetHarness, at = 'B2') {
  return renderSheet(
    h,
    (p) => {
      actions = p.actions;
      return <SheetCellEditor input={p.input} fontFamily="Inter" />;
    },
    { at },
  );
}
const editor = () => screen.getByRole('textbox') as HTMLTextAreaElement;
const overlay = () => editor().previousElementSibling as HTMLElement;
const frame = () => editor().parentElement as HTMLElement;

describe('the cell editor', () => {
  let h: SheetHarness;
  beforeEach(async () => {
    h = await makeSheet({
      cells: { B2: 'hello', C3: '=A1+B2' },
      format: { C3: { b: true, i: true, fc: '#ff0000', bg: '#00ff00', fs: 14 } },
    });
  });

  it('is there only while a cell is edited in place', () => {
    show(h);
    expect(screen.queryByRole('textbox')).toBeNull();
    act(() => actions.startEdit('bar'));
    expect(screen.queryByRole('textbox')).toBeNull();
    act(() => h.ctl().setEditing(null));
    act(() => actions.startEdit('cell'));
    expect(editor().getAttribute('aria-label')).toBe('Edit cell B2');
    expect(editor().value).toBe('hello');
  });

  it('sits over its cell, scrolled with the grid, focused with the caret at the end', () => {
    show(h);
    act(() => h.ctl().setScroll({ top: 5, left: 10 }));
    act(() => actions.startEdit('cell'));
    const box = cellBox(h.ctl().geometry, 1, 1, { top: 5, left: 10 });
    const wrap = frame().parentElement!;
    expect(wrap.style.left).toBe(`${box.x - 1}px`);
    expect(wrap.style.top).toBe(`${box.y - 1}px`);
    expect(frame().style.width).toBe(`${box.w + 2}px`);
    // At least one line of text tall.
    expect(frame().style.height).toBe(
      `${Math.max(box.h, Math.round(fontPx(undefined) * 1.3) + 8) + 2}px`,
    );
    expect(document.activeElement).toBe(editor());
    expect(editor().selectionStart).toBe(5);
    expect(editor().style.fontFamily).toBe('Inter');
  });

  it('covers a merged cell whole', () => {
    show(h);
    act(() => h.select('B2:C3'));
    act(() => actions.merge('all', () => true));
    act(() => h.select('B2'));
    act(() => actions.startEdit('cell'));
    const g = h.ctl().geometry;
    const box = cellBox(g, 1, 1, { top: 0, left: 0 }, mergeAt(g, 1, 1));
    expect(frame().style.width).toBe(`${box.w + 2}px`);
    expect(frame().style.height).toBe(`${box.h + 2}px`);
  });

  it('draws the draft in the cell’s format', () => {
    show(h, 'C3');
    act(() => actions.startEdit('cell'));
    expect(editor().style.fontWeight).toBe('700');
    expect(editor().style.fontStyle).toBe('italic');
    expect(editor().style.fontSize).toBe(`${Math.round((14 * 4) / 3)}px`);
    expect(editor().style.caretColor).toBe('rgb(255, 0, 0)');
    expect(overlay().style.color).toBe('rgb(255, 0, 0)');
    expect(frame().style.backgroundColor).toBe('rgb(0, 255, 0)');
    // Each reference in its colour.
    const refs = [...overlay().querySelectorAll('span')].map((s) => s.textContent);
    expect(refs).toEqual(['A1', 'B2']);
  });

  it('grows with its text, across and down, up to the grid’s edge', () => {
    show(h);
    act(() => h.ctl().setView({ width: 400, height: 300 }));
    act(() => actions.startEdit('cell', 'x'.repeat(200)));
    const box = cellBox(h.ctl().geometry, 1, 1, { top: 0, left: 0 });
    expect(frame().style.width).toBe(`${400 - box.x - 8 + 2}px`);
    act(() => h.ctl().setEditing({ ...h.ctl().editing!, draft: 'a\nb\nc\n' }));
    const lineH = Math.round(fontPx(undefined) * 1.3);
    expect(parseFloat(frame().style.height)).toBeGreaterThanOrEqual(4 * lineH + 8);
    // A trailing line break is drawn with a character after it.
    expect(overlay().textContent).toBe('a\nb\nc\n ');
  });

  it('lists the functions a name could be, the one picked shown', () => {
    show(h);
    act(() => actions.startEdit('type', '='));
    fireEvent.change(editor(), { target: { value: '=COUN', selectionStart: 5 } });
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(1);
    expect(options.every((o) => o.textContent!.startsWith('COUN'))).toBe(true);
    expect(options[0]!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(editor(), { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]!.getAttribute('aria-selected')).toBe('true');
    const name = options[1]!.querySelector('.font-semibold')!.textContent!;
    fireEvent.pointerDown(screen.getAllByRole('option')[1]!);
    expect(h.ctl().editing?.draft).toBe(`=${name}(`);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('shows the argument the caret is in', () => {
    show(h);
    act(() => actions.startEdit('type', '=IF(A1>1, '));
    const note = screen.getByRole('note');
    expect(note.textContent).toMatch(/^IF\(/);
    const bold = [...note.querySelectorAll('span')].find((s) => s.style.fontWeight === '700');
    expect(bold?.textContent).toContain(',');
  });

  it('underlines what cannot be read and says why, until the draft changes', () => {
    show(h);
    act(() => actions.startEdit('type', '=SUM(1,'));
    fireEvent.keyDown(editor(), { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).not.toBe('');
    const wavy = [...overlay().querySelectorAll('span')].find((s) =>
      s.style.textDecoration.includes('wavy'),
    );
    expect(wavy).toBeTruthy();
    expect(h.ctl().editing).not.toBeNull();
    fireEvent.change(editor(), { target: { value: '=SUM(1,2)' } });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.keyDown(editor(), { key: 'Enter' });
    expect(h.value('B2')).toBe(3);
  });

  it('underlines a blank at the end when the formula stops short', () => {
    show(h);
    act(() => actions.startEdit('type', '=1+'));
    fireEvent.keyDown(editor(), { key: 'Enter' });
    const wavy = [...overlay().querySelectorAll('span')].find((s) =>
      s.style.textDecoration.includes('wavy'),
    );
    expect(wavy?.textContent).toMatch(/^\s*$/);
  });

  it('keeps presses to itself', () => {
    const outer = vi.fn();
    renderSheet(
      h,
      (p) => {
        actions = p.actions;
        return (
          <div onPointerDown={outer}>
            <SheetCellEditor input={p.input} />
          </div>
        );
      },
      { at: 'B2' },
    );
    act(() => actions.startEdit('cell'));
    fireEvent.pointerDown(editor());
    fireEvent.select(editor());
    expect(outer).not.toHaveBeenCalled();
  });
});
