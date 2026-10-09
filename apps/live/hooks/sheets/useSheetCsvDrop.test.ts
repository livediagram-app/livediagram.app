// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { takePlacedSheet } from '@/lib/sheet-seeds';
import {
  SHEET_CSV_DROP_BYTES_MAX,
  csvFileTitle,
  isSheetCsvFile,
  useSheetCsvDrop,
} from './useSheetCsvDrop';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(opts: { planMode?: boolean; blocked?: boolean } = {}) {
  const addBoxedAt = vi.fn((x: number, y: number, make: (x: number, y: number) => unknown) =>
    make(x, y),
  );
  const dropOther = vi.fn();
  const toast = vi.fn();
  const { result } = renderHook(() =>
    useSheetCsvDrop({
      planMode: opts.planMode ?? true,
      blocked: opts.blocked ?? false,
      addBoxedAt: addBoxedAt as never,
      dropOther,
      toast,
    }),
  );
  return { drop: result.current, addBoxedAt, dropOther, toast };
}

describe('dropping a CSV file on the canvas', () => {
  it('knows a CSV file and titles a sheet by its name', () => {
    expect(isSheetCsvFile({ name: 'Budget.CSV', type: '' })).toBe(true);
    expect(isSheetCsvFile({ name: 'export', type: 'text/csv' })).toBe(true);
    expect(isSheetCsvFile({ name: 'scene.excalidraw', type: 'application/json' })).toBe(false);
    expect(csvFileTitle('Q3 budget.csv')).toBe('Q3 budget');
  });

  it('places a Sheet named after the file, carrying its text, in Plan mode', async () => {
    const { drop, addBoxedAt, dropOther } = setup();
    drop(new File(['a,b\n1,2'], 'Budget.csv', { type: 'text/csv' }), { x: 10, y: 20 });
    await flush();
    expect(dropOther).not.toHaveBeenCalled();
    const el = addBoxedAt.mock.results[0]!.value as {
      shape: string;
      planSheet: { sheetId: string };
    };
    expect(el.shape).toBe('plan-sheet');
    expect(takePlacedSheet(el.planSheet.sheetId)).toEqual({ title: 'Budget', csv: 'a,b\n1,2' });
  });

  it('hands other files, and any file outside Plan mode, to the canvas', () => {
    const other = setup();
    other.drop(new File(['{}'], 'scene.excalidraw'), { x: 0, y: 0 });
    expect(other.dropOther).toHaveBeenCalled();
    const diagram = setup({ planMode: false });
    diagram.drop(new File(['a'], 'a.csv'), { x: 0, y: 0 });
    expect(diagram.dropOther).toHaveBeenCalled();
  });

  it('refuses a file too large for a sheet, and places nothing while blocked', async () => {
    const big = setup();
    const file = new File(['a'], 'big.csv');
    Object.defineProperty(file, 'size', { value: SHEET_CSV_DROP_BYTES_MAX + 1 });
    big.drop(file, { x: 0, y: 0 });
    expect(big.toast).toHaveBeenCalledWith('That file is too large for a sheet');
    const blocked = setup({ blocked: true });
    blocked.drop(new File(['a'], 'a.csv'), { x: 0, y: 0 });
    await flush();
    expect(blocked.addBoxedAt).not.toHaveBeenCalled();
    expect(blocked.dropOther).not.toHaveBeenCalled();
  });
});
