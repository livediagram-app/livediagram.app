// @vitest-environment jsdom
// Column letters and row numbers (docs/specs/029-sheets/sheet.md "The grid", "Rows and columns"): tinted where the
// selection is, the frozen ones always drawn, and a small arrow between the neighbours of hidden lines.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Selection, SheetLayout } from '@livediagram/sheets';
import { planPalette } from '@/components/plan/plan-palette';
import { SheetHeaders } from './SheetHeaders';
import { geometryOf, visibleWindow } from './sheet-geometry';

const palette = planPalette('light');

function grid(rows: number, cols: number, extra: Partial<SheetLayout> = {}): SheetLayout {
  return {
    rows: Array.from({ length: rows }, (_, i) => `r${i}`),
    cols: Array.from({ length: cols }, (_, i) => `c${i}`),
    ...extra,
  };
}

function draw(
  layout: SheetLayout,
  opts: {
    selection?: Selection | null;
    scroll?: { top: number; left: number };
    view?: { width: number; height: number };
    onUnhide?: ((axis: 'r' | 'c', from: number, to: number) => void) | null;
  } = {},
) {
  const g = geometryOf(layout);
  const scroll = opts.scroll ?? { top: 0, left: 0 };
  const view = opts.view ?? { width: 900, height: 400 };
  return render(
    <SheetHeaders
      geometry={g}
      window={visibleWindow(g, scroll, view)}
      scroll={scroll}
      palette={palette}
      selection={opts.selection ?? null}
      view={view}
      onUnhide={opts.onUnhide ?? null}
    />,
  );
}

const texts = (role: string) => screen.queryAllByRole(role).map((el) => el.textContent);
const tinted = (el: HTMLElement) => el.dataset.selected !== undefined;

describe('the sheet headers', () => {
  it('letters the columns and numbers the rows', () => {
    draw(grid(4, 3));
    expect(texts('columnheader')).toEqual(['A', 'B', 'C']);
    expect(texts('rowheader')).toEqual(['1', '2', '3', '4']);
  });

  it('tints the headers the selection covers', () => {
    draw(grid(4, 3), {
      selection: {
        ranges: [{ r1: 1, c1: 1, r2: 2, c2: 1 }],
        active: { r: 1, c: 1 },
        anchor: { r: 1, c: 1 },
      },
    });
    expect(screen.getAllByRole('columnheader').map(tinted)).toEqual([false, true, false]);
    expect(screen.getAllByRole('rowheader').map(tinted)).toEqual([false, true, true, false]);
  });

  it('draws a whole selected column solid and a column the selection only crosses tinted', () => {
    draw(grid(4, 3), {
      selection: {
        ranges: [
          { r1: 0, c1: 0, r2: 3, c2: 0 },
          { r1: 1, c1: 2, r2: 1, c2: 2 },
        ],
        active: { r: 0, c: 0 },
        anchor: { r: 0, c: 0 },
      },
    });
    expect(screen.getAllByRole('columnheader').map((el) => el.dataset.selected)).toEqual([
      'line',
      undefined,
      'cells',
    ]);
    expect(screen.getAllByRole('rowheader')[1]!.dataset.selected).toBe('cells');
  });

  it('tints nothing without a selection (outside Plan mode)', () => {
    draw(grid(2, 2));
    expect(screen.getAllByRole('columnheader').some(tinted)).toBe(false);
  });

  it('leaves out hidden lines', () => {
    draw(grid(3, 3, { hiddenCols: ['c1'], hiddenRows: ['r0'] }));
    expect(texts('columnheader')).toEqual(['A', 'C']);
    expect(texts('rowheader')).toEqual(['2', '3']);
  });

  it('always draws frozen headers, and drops scrolled ones gone under the frozen pane', () => {
    draw(grid(40, 20, { frozenCols: 1, frozenRows: 1 }), {
      scroll: { top: 24 * 10, left: 100 * 8 },
      view: { width: 500, height: 300 },
    });
    const cols = texts('columnheader');
    expect(cols[0]).toBe('A');
    expect(cols).not.toContain('F');
    expect(cols).toContain('J');
    const rows = texts('rowheader');
    expect(rows[0]).toBe('1');
    expect(rows).not.toContain('8');
    expect(rows).toContain('12');
  });

  it('shows hidden columns and rows again from the arrow between their neighbours', () => {
    const onUnhide = vi.fn();
    draw(grid(6, 6, { hiddenCols: ['c1', 'c2'], hiddenRows: ['r3'] }), { onUnhide });
    const cols = screen.getByRole('button', { name: 'Show Columns B to C' });
    fireEvent.pointerDown(cols);
    fireEvent.click(cols);
    expect(onUnhide).toHaveBeenLastCalledWith('c', 1, 2);
    fireEvent.click(screen.getByRole('button', { name: 'Show Row 4' }));
    expect(onUnhide).toHaveBeenLastCalledWith('r', 3, 3);
  });

  it('keeps the way back for hidden lines when the sheet hides its headers', () => {
    const onUnhide = vi.fn();
    draw(grid(6, 6, { hiddenCols: ['c2'], hiddenRows: ['r3'], showHeaders: false }), { onUnhide });
    expect(texts('columnheader')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Show Row 4' }));
    expect(onUnhide).toHaveBeenLastCalledWith('r', 3, 3);
    expect(screen.getByRole('button', { name: 'Show Column C' })).toBeTruthy();
  });

  it('names a single hidden column and a run of hidden rows', () => {
    draw(grid(6, 6, { hiddenCols: ['c4'], hiddenRows: ['r1', 'r2'] }), { onUnhide: vi.fn() });
    expect(screen.getByRole('button', { name: 'Show Column E' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show Rows 2 to 3' })).toBeTruthy();
  });

  it('keeps the arrow away from someone who may not edit, and out of view', () => {
    draw(grid(6, 6, { hiddenCols: ['c1'], hiddenRows: ['r1'] }));
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    draw(grid(60, 20, { hiddenCols: ['c15'], hiddenRows: ['r50'] }), {
      onUnhide: vi.fn(),
      view: { width: 400, height: 300 },
    });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
