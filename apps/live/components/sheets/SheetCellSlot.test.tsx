// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SheetCellSlot } from './SheetCellSlot';

describe('SheetCellSlot', () => {
  it('puts a control drawn over a cell in that cell’s row and gridcell, by one-based index', () => {
    render(
      <div role="grid">
        <SheetCellSlot r={4} c={2}>
          <button type="button">Filter column 3</button>
        </SheetCellSlot>
      </div>,
    );
    const cell = screen.getByRole('gridcell');
    expect(cell.getAttribute('aria-colindex')).toBe('3');
    expect(screen.getByRole('row').getAttribute('aria-rowindex')).toBe('5');
    expect(cell.contains(screen.getByRole('button', { name: 'Filter column 3' }))).toBe(true);
    // Unstyled, so the control's absolute placement still answers to the layer it is drawn in.
    expect(cell.className).toBe('');
    expect(screen.getByRole('row').className).toBe('');
  });
});
