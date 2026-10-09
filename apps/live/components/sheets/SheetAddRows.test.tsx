// @vitest-environment jsdom
// Add Rows below the last row (docs/specs/029-sheets/sheet.md "The grid"): a count field, clamped to the room left
// under the row limit, Enter adds, and it is gone at the limit or for someone who may only look.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SHEET_ROWS_MAX } from '@livediagram/sheets';
import { planPalette } from '@/components/plan/plan-palette';
import { SheetControllerProvider, type SheetController } from './sheet-controller';
import { SheetAddRows } from './SheetAddRows';

function draw(rows: number, canEdit = true) {
  const onAdd = vi.fn();
  const focusGrid = vi.fn();
  const c = {
    canEdit,
    sheet: { layout: { rows: { length: rows } } },
    geometry: { headW: 46, headH: 22 },
    palette: planPalette('light'),
    focusGrid,
  } as unknown as SheetController;
  const outside = { pointer: vi.fn(), key: vi.fn() };
  const view = render(
    <div onPointerDown={outside.pointer} onKeyDown={outside.key}>
      <SheetControllerProvider value={c}>
        <SheetAddRows top={100} onAdd={onAdd} />
      </SheetControllerProvider>
    </div>,
  );
  return { ...view, onAdd, focusGrid, outside };
}

const field = () => screen.getByRole('textbox', { name: 'Rows to add' }) as HTMLInputElement;

describe('Add Rows', () => {
  it('adds 100 rows by default and hands the keys back to the grid', () => {
    const h = draw(30);
    expect(field().value).toBe('100');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(h.onAdd).toHaveBeenCalledWith(100);
    expect(h.focusGrid).toHaveBeenCalled();
  });

  it('takes digits only, at most five, and Enter adds that many', () => {
    const h = draw(30);
    fireEvent.change(field(), { target: { value: '2a5x0' } });
    expect(field().value).toBe('250');
    fireEvent.change(field(), { target: { value: '1234567' } });
    expect(field().value).toBe('12345');
    fireEvent.change(field(), { target: { value: '25' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(h.onAdd).toHaveBeenCalledWith(25);
    // Other keys stay in the field.
    fireEvent.keyDown(field(), { key: 'a' });
    expect(h.onAdd).toHaveBeenCalledTimes(1);
    expect(h.outside.key).not.toHaveBeenCalled();
  });

  it('adds the default for an empty or zero count', () => {
    const h = draw(30);
    fireEvent.change(field(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(field(), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(h.onAdd.mock.calls).toEqual([[100], [100]]);
  });

  it('clamps the count to the room left under the row limit', () => {
    const h = draw(SHEET_ROWS_MAX - 40);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(h.onAdd).toHaveBeenCalledWith(40);
  });

  it('keeps presses and keys from reaching the grid', () => {
    const h = draw(30);
    fireEvent.pointerDown(field());
    expect(h.outside.pointer).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Add' }), { key: 'ArrowDown' });
    expect(h.outside.key).not.toHaveBeenCalled();
  });

  it('is gone at the limit and for someone who may only look', () => {
    const full = draw(SHEET_ROWS_MAX);
    expect(full.container.textContent).toBe('');
    const viewer = draw(30, false);
    expect(viewer.container.textContent).toBe('');
  });
});
