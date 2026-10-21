// @vitest-environment jsdom
// What sits over the cells (docs/specs/029-sheets/sheet.md "Selection", "Writing formulas", "Filter",
// "Collaboration"): the selection with its fill handle, the active cell, the copied range's marquee, outlines
// (Find's highlights, a formula's references, a peer's selection and name tag) and the filter's buttons.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Selection, SheetLayout } from '@livediagram/sheets';
import { planPalette } from '@/components/plan/plan-palette';
import {
  FILL_HANDLE_PX,
  PEER_TAG_MS,
  SheetSelectionLayer,
  fillHandleAt,
  type Outline,
} from './SheetSelectionLayer';
import { geometryOf } from './sheet-geometry';

const palette = planPalette('light');

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

const sel = (r1: number, c1: number, r2 = r1, c2 = c1): Selection => ({
  ranges: [{ r1, c1, r2, c2 }],
  active: { r: r1, c: c1 },
  anchor: { r: r1, c: c1 },
});

const g = geometryOf(grid(20, 10, { merges: [{ r1: 'r5', c1: 'c5', r2: 'r6', c2: 'c6' }] }));

function draw(p: Partial<React.ComponentProps<typeof SheetSelectionLayer>> = {}) {
  return render(
    <SheetSelectionLayer
      geometry={g}
      scroll={{ top: 0, left: 0 }}
      palette={palette}
      selection={sel(0, 0)}
      showHandle={false}
      marquee={null}
      outlines={[]}
      filter={null}
      onFilterButton={null}
      {...p}
    />,
  );
}

// Every box the layer draws, by its inline style.
const boxes = (container: HTMLElement) =>
  [...container.firstElementChild!.querySelectorAll<HTMLElement>('div')].map((el) => el.style);

afterEach(() => {
  vi.useRealTimers();
});

describe('fillHandleAt', () => {
  it('is the bottom-right corner of the last range, a merge included, less the scroll', () => {
    expect(fillHandleAt(g, sel(1, 1, 2, 3), { top: 0, left: 0 })).toEqual({ x: 400, y: 72 });
    expect(fillHandleAt(g, sel(1, 1, 2, 3), { top: 24, left: 100 })).toEqual({ x: 300, y: 48 });
    // The range ends on a merge's top-left: the handle sits at the merge's far corner.
    expect(fillHandleAt(g, sel(5, 5), { top: 0, left: 0 })).toEqual({ x: 700, y: 168 });
  });
});

describe('the selection layer', () => {
  it('draws the fill handle at the selection corner only when asked', () => {
    const { container, rerender } = draw({ selection: sel(1, 1, 2, 3), showHandle: true });
    const handle = container.querySelector<HTMLElement>('[data-sheet-fill-handle]')!;
    expect(handle.style.left).toBe(`${400 - FILL_HANDLE_PX / 2}px`);
    expect(handle.style.top).toBe(`${72 - FILL_HANDLE_PX / 2}px`);
    rerender(
      <SheetSelectionLayer
        geometry={g}
        scroll={{ top: 0, left: 0 }}
        palette={palette}
        selection={sel(1, 1, 2, 3)}
        showHandle={false}
        marquee={null}
        outlines={[]}
        filter={null}
        onFilterButton={null}
      />,
    );
    expect(container.querySelector('[data-sheet-fill-handle]')).toBeNull();
  });

  it('draws each range, and the active cell with a thicker border over a merge', () => {
    const { container } = draw({
      selection: {
        ranges: [
          { r1: 0, c1: 0, r2: 0, c2: 0 },
          { r1: 5, c1: 5, r2: 6, c2: 6 },
        ],
        active: { r: 5, c: 5 },
        anchor: { r: 5, c: 5 },
      },
    });
    const styles = boxes(container);
    const rangeBoxes = styles.filter((s) => s.zIndex === '4');
    expect(rangeBoxes.map((s) => [s.left, s.top, s.width, s.height])).toEqual([
      ['0px', '0px', '100px', '24px'],
      ['500px', '120px', '200px', '48px'],
    ]);
    const active = styles.find((s) => s.border.startsWith('2px'))!;
    expect([active.left, active.top, active.width, active.height]).toEqual([
      '499px',
      '119px',
      '201px',
      '49px',
    ]);
  });

  it('draws the active cell quieter while another Sheet has the keys', () => {
    const { container } = draw({ quiet: true });
    expect(boxes(container).some((s) => s.border.startsWith('2px'))).toBe(false);
  });

  it('draws the copied range as a dashed marquee', () => {
    const { container } = draw({ marquee: { range: { r1: 2, c1: 1, r2: 3, c2: 2 }, cut: true } });
    const m = boxes(container).find((s) => s.border.includes('dashed'))!;
    expect([m.left, m.top, m.width, m.height]).toEqual(['100px', '48px', '200px', '48px']);
  });

  it('draws outlines: a highlight with no border, a dashed reference, a thick editing peer', () => {
    const outlines: Outline[] = [
      { range: { r1: 0, c1: 0, r2: 0, c2: 0 }, color: '#facc15', highlight: true },
      { range: { r1: 1, c1: 0, r2: 1, c2: 0 }, color: '#2563eb', dashed: true },
      { range: { r1: 2, c1: 0, r2: 2, c2: 0 }, color: '#16a34a', thick: true },
    ];
    const { container } = draw({ outlines, selection: sel(9, 9) });
    const at = (top: string) =>
      boxes(container).find((s) => s.top === top && s.zIndex === '5' && s.left === '0px')!;
    expect(at('0px').border).toBe('');
    expect(at('24px').border).toContain('dashed');
    expect(at('48px').border).toContain('3px');
  });

  it('shows a peer name tag, hides it after a while still, and shows it again on hover', () => {
    vi.useFakeTimers();
    const outline = (hover: boolean): Outline => ({
      range: { r1: 1, c1: 1, r2: 1, c2: 1 },
      color: '#e11d48',
      label: 'Ada',
      labelAt: Date.now(),
      labelHover: hover,
    });
    const first = outline(false);
    const { rerender } = draw({ outlines: [first] });
    expect(screen.getByText('Ada')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(PEER_TAG_MS);
    });
    expect(screen.queryByText('Ada')).toBeNull();
    const props = {
      geometry: g,
      scroll: { top: 0, left: 0 },
      palette,
      selection: sel(0, 0),
      showHandle: false,
      marquee: null,
      filter: null,
      onFilterButton: null,
    };
    rerender(<SheetSelectionLayer {...props} outlines={[{ ...first, labelHover: true }]} />);
    expect(screen.getByText('Ada')).toBeTruthy();
    // Moving again (a new time) shows it at once.
    act(() => {
      vi.advanceTimersByTime(10);
    });
    rerender(<SheetSelectionLayer {...props} outlines={[{ ...first, labelAt: Date.now() }]} />);
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('keeps a name tag with no time showing', () => {
    vi.useFakeTimers();
    draw({
      outlines: [{ range: { r1: 1, c1: 1, r2: 1, c2: 1 }, color: '#e11d48', label: 'Bo' }],
    });
    act(() => {
      vi.advanceTimersByTime(PEER_TAG_MS * 2);
    });
    expect(screen.getByText('Bo')).toBeTruthy();
  });

  it('puts a filter button on each column of the filter header, opening its menu below', () => {
    const onFilterButton = vi.fn();
    const outside = vi.fn();
    render(
      <div onPointerDown={outside}>
        <SheetSelectionLayer
          geometry={g}
          scroll={{ top: 0, left: 0 }}
          palette={palette}
          selection={sel(0, 0)}
          showHandle={false}
          marquee={null}
          outlines={[]}
          filter={{
            r: 0,
            cols: [
              { c: 0, colId: 'c0', active: false },
              { c: 1, colId: 'c1', active: true },
            ],
          }}
          onFilterButton={onFilterButton}
        />
      </div>,
    );
    const a = screen.getByRole('button', { name: 'Filter column 1' });
    const b = screen.getByRole('button', { name: 'Filter column 2' });
    expect(a.style.left).toBe('82px');
    expect(b.style.color).toBe('rgb(255, 255, 255)');
    expect(a.style.color).not.toBe('rgb(255, 255, 255)');
    b.getBoundingClientRect = () => ({ left: 30, bottom: 40 }) as DOMRect;
    fireEvent.pointerDown(b);
    expect(outside).not.toHaveBeenCalled();
    fireEvent.click(b);
    expect(onFilterButton).toHaveBeenCalledWith('c1', { x: 30, y: 42 });
  });

  it('draws no filter buttons where they cannot open a menu', () => {
    draw({ filter: { r: 0, cols: [{ c: 0, colId: 'c0', active: false }] } });
    expect(screen.queryByRole('button')).toBeNull();
  });
});
