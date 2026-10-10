// @vitest-environment jsdom
// The visible cells (docs/specs/029-sheets/sheet.md "The grid"): values drawn with their formats, aligned by kind,
// errors in red; text running over empty neighbours; numbers too wide showing fewer decimals, then scientific, then
// ####; merges, hidden lines and the frozen panes.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Workbook,
  cellKey,
  parseA1,
  readTypedInput,
  type CellFormat,
  type Sheet,
  type SheetLayout,
} from '@livediagram/sheets';
import { planPalette } from '@/components/plan/plan-palette';
import { SheetCells, fitNumber, fontPx, roughWidth } from './SheetCells';
import { geometryOf, visibleWindow } from './sheet-geometry';

const palette = planPalette('light');
const RED = 'rgb(220, 38, 38)';

function grid(rows: number, cols: number, extra: Partial<SheetLayout> = {}): SheetLayout {
  return {
    rows: Array.from({ length: rows }, (_, i) => `r${i}`),
    cols: Array.from({ length: cols }, (_, i) => `c${i}`),
    ...extra,
    // Fixed sizes (100 x 24), so the arithmetic below tests the geometry, not the engine's defaults.
    rowSize: {
      ...Object.fromEntries(Array.from({ length: rows }, (_, i) => [`r${i}`, 24])),
      ...extra.rowSize,
    },
    colSize: {
      ...Object.fromEntries(Array.from({ length: cols }, (_, i) => [`c${i}`, 100])),
      ...extra.colSize,
    },
  };
}

// A sheet typed in as a person would (A1 -> text), with formats by A1.
function sheetOf(
  cells: Record<string, string>,
  formats: Record<string, CellFormat> = {},
  layout: SheetLayout = grid(10, 6),
) {
  const sheet: Sheet = {
    id: 's1',
    tabId: 't1',
    title: 'Sheet 1',
    layout,
    cells: new Map(),
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: { id: '', name: '', color: '#000000' },
  };
  const typing = new Workbook({ sheets: [sheet], locale: 'en-GB' });
  const key = (a1: string) => {
    const p = parseA1(a1)!;
    return cellKey(layout.rows[p.r]!, layout.cols[p.c]!);
  };
  for (const [a1, text] of Object.entries(cells)) {
    const read = readTypedInput(text, 'en-GB', typing.ctxFor(sheet.id));
    if (read.kind !== 'value') throw new Error(`${a1}: ${text}`);
    sheet.cells.set(key(a1), {
      input: read.input,
      ...(read.hint ? { format: { nf: read.hint.nf } } : {}),
    });
  }
  for (const [a1, f] of Object.entries(formats)) {
    const before = sheet.cells.get(key(a1));
    sheet.cells.set(key(a1), { ...before, format: { ...before?.format, ...f } });
  }
  return { sheet, workbook: new Workbook({ sheets: [sheet], locale: 'en-GB' }) };
}

function draw(
  { sheet, workbook }: ReturnType<typeof sheetOf>,
  opts: {
    scroll?: { top: number; left: number };
    view?: { width: number; height: number };
    fontFamily?: string;
  } = {},
) {
  const geometry = geometryOf(sheet.layout);
  const scroll = opts.scroll ?? { top: 0, left: 0 };
  return render(
    <SheetCells
      sheet={sheet}
      workbook={workbook}
      version={0}
      geometry={geometry}
      window={visibleWindow(geometry, scroll, opts.view ?? { width: 800, height: 400 })}
      scroll={scroll}
      palette={palette}
      locale="en-GB"
      fontFamily={opts.fontFamily}
    />,
  );
}

const textBox = (text: string) => screen.getByText(text) as HTMLElement;

describe('the helpers', () => {
  it('sizes fonts from the point size, else the base', () => {
    expect(fontPx(undefined)).toBe(13);
    expect(fontPx({ fs: 12 })).toBe(16);
  });

  it('measures digits and spaces narrower than letters', () => {
    expect(roughWidth('ab 1', 10)).toBeCloseTo(20.3);
  });

  it('keeps a number that fits, else fewer digits, then scientific, then ####', () => {
    expect(fitNumber('42', 42, undefined, 100, 13)).toBe('42');
    expect(fitNumber(String(Math.PI), Math.PI, undefined, 60, 13)).toBe('3.14159');
    expect(fitNumber('123456789012', 123456789012, undefined, 70, 13)).toBe('1.2E+11');
    expect(fitNumber('123456789012', 123456789012, undefined, 50, 13)).toBe('#####');
    expect(fitNumber('0.000000000001234', 1.234e-12, { nf: 'auto' }, 70, 13)).toBe('1.23E-12');
    // A chosen number format is never rounded to fit: ####.
    expect(fitNumber('1,234,567.00', 1234567, { nf: 'number' }, 50, 13)).toMatch(/^#+$/);
  });
});

describe('the cells', () => {
  it('aligns text left, numbers right and booleans and errors centred, errors in red', () => {
    draw(sheetOf({ A1: 'hello', B1: '42', C1: 'TRUE', D1: '=1/0' }));
    expect(textBox('hello').style.justifyContent).toBe('flex-start');
    expect(textBox('42').style.justifyContent).toBe('flex-end');
    expect(textBox('TRUE').style.justifyContent).toBe('center');
    const err = textBox('#DIV/0!');
    expect(err.style.justifyContent).toBe('center');
    expect(err.style.color).toBe(RED);
  });

  it('draws a cell’s format: weight, style, decoration, colours, size and alignment', () => {
    draw(
      sheetOf(
        { A1: 'styled', A2: 'top', A3: 'mid', A4: 'wrapped' },
        {
          A1: {
            b: true,
            i: true,
            u: true,
            st: true,
            fc: '#ff0000',
            bg: '#00ff00',
            fs: 12,
            ha: 'c',
          },
          A2: { va: 't' },
          A3: { va: 'm', ha: 'r' },
          A4: { wr: 'w' },
        },
      ),
    );
    const s = textBox('styled').style;
    expect(s.fontWeight).toBe('700');
    expect(s.fontStyle).toBe('italic');
    expect(s.textDecoration).toBe('underline line-through');
    expect(s.color).toBe('rgb(255, 0, 0)');
    expect(s.fontSize).toBe('16px');
    expect(s.justifyContent).toBe('center');
    const bg = [...document.querySelectorAll<HTMLElement>('div')].find(
      (el) => el.style.backgroundColor === 'rgb(0, 255, 0)',
    );
    expect(bg).toBeTruthy();
    expect(textBox('top').style.alignItems).toBe('flex-start');
    expect(textBox('mid').style.alignItems).toBe('center');
    expect(textBox('mid').style.justifyContent).toBe('flex-end');
    expect(textBox('wrapped').className).toContain('whitespace-pre-wrap');
  });

  it('draws a number format', () => {
    draw(sheetOf({ A1: '3' }, { A1: { nf: 'number', dp: 2 } }));
    expect(screen.getByText('3.00')).toBeTruthy();
  });

  it('draws borders over the cell', () => {
    const { container } = draw(sheetOf({}, { B2: { bt: { w: 2, s: 'dashed', c: '#123456' } } }));
    const border = [...container.querySelectorAll<HTMLElement>('div')].find((el) =>
      el.style.borderTop.includes('dashed'),
    )!;
    expect(border.style.borderTop).toBe('2px dashed rgb(18, 52, 86)');
    expect([border.style.left, border.style.top]).toEqual(['99px', '23px']);
  });

  it('runs left-aligned text over empty neighbours, stopping at a filled one', () => {
    const long = 'a fairly long run of words that spills';
    draw(sheetOf({ A1: long, A2: long, B2: 'x' }));
    const [first, second] = screen.getAllByText(long);
    expect(Number.parseFloat(first!.style.width)).toBeGreaterThan(100);
    expect(first!.className).not.toContain('overflow-hidden');
    expect(second!.style.width).toBe('100px');
    expect(second!.className).toContain('overflow-hidden');
  });

  it('never runs a number, right-aligned text or clipped text over its neighbours', () => {
    const long = 'a fairly long run of words that spills';
    draw(sheetOf({ A1: long, A2: long }, { A1: { ha: 'r' }, A2: { wr: 'c' } }));
    for (const el of screen.getAllByText(long)) expect(el.style.width).toBe('100px');
  });

  it('skips hidden columns when running over, and stops at a merge', () => {
    const long = 'a fairly long run of words that spills over plenty of columns indeed';
    draw(
      sheetOf(
        { A1: long, A2: long },
        {},
        grid(10, 6, { hiddenCols: ['c1'], merges: [{ r1: 'r1', c1: 'c1', r2: 'r1', c2: 'c2' }] }),
      ),
    );
    const [first, second] = screen.getAllByText(long);
    expect(Number.parseFloat(first!.style.width)).toBeGreaterThan(100);
    expect(second!.style.width).toBe('100px');
  });

  it('shows too wide a number in scientific form', () => {
    draw(sheetOf({ A1: '12345678901234' }));
    expect(screen.getByText('1.2E+13')).toBeTruthy();
  });

  it('draws a merge once, over its whole span', () => {
    const { container } = draw(
      sheetOf(
        { B2: 'merged' },
        {},
        grid(10, 6, { merges: [{ r1: 'r1', c1: 'c1', r2: 'r2', c2: 'c2' }] }),
      ),
    );
    const box = textBox('merged').style;
    expect([box.width, box.height]).toEqual(['200px', '48px']);
    // B2's merge stands for B2:C3: one cell box where four would be.
    const cellBoxes = container.querySelectorAll('.border-b.border-r');
    expect(cellBoxes).toHaveLength(10 * 6 - 3);
  });

  it('leaves out hidden rows and columns', () => {
    const { container } = draw(
      sheetOf(
        { A1: 'gone', B2: 'kept' },
        {},
        grid(4, 3, { hiddenRows: ['r0'], hiddenCols: ['c2'] }),
      ),
    );
    expect(screen.queryByText('gone')).toBeNull();
    expect(screen.getByText('kept')).toBeTruthy();
    expect(container.querySelectorAll('.border-b.border-r')).toHaveLength(3 * 2);
  });

  it('keeps frozen cells in place with a thicker edge line, however far it scrolls', () => {
    const layout = grid(200, 40, { frozenRows: 1, frozenCols: 1 });
    const { container } = draw(
      sheetOf({ A1: 'corner', B1: 'top', A2: 'side', Z150: 'far' }, {}, layout),
      {
        scroll: { top: 24 * 140, left: 100 * 20 },
        view: { width: 600, height: 300 },
      },
    );
    expect(textBox('corner').style.left).toBe('0px');
    expect(screen.queryByText('top')).toBeNull();
    expect(screen.queryByText('side')).toBeNull();
    expect(textBox('far')).toBeTruthy();
    const edges = [...container.querySelectorAll<HTMLElement>('div')].filter(
      (el) => el.style.zIndex === '3',
    );
    expect(edges).toHaveLength(2);
  });

  it('shows a value that is still loading as Loading…, left-aligned', () => {
    draw(sheetOf({ A1: '=CARDCOUNT()' }));
    expect(textBox('Loading…').style.justifyContent).toBe('flex-start');
  });

  // A pending value is an error underneath (#N/A, why "pending"): it is still drawn muted.
  it('draws a value that is still loading muted, not as an error', () => {
    draw(sheetOf({ A1: '=CARDCOUNT()' }));
    expect(textBox('Loading…').style.color).not.toBe(RED);
  });

  it('uses the element’s font', () => {
    const { container } = draw(sheetOf({}), { fontFamily: 'Georgia' });
    expect((container.firstElementChild as HTMLElement).style.fontFamily).toBe('Georgia');
  });
});
