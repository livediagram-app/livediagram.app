// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { emptyLayout, single, type SheetLayout } from '@livediagram/sheets';
import { EDIT_LOST, followSelection, useFollowLayout } from './useFollowLayout';

let seq = 11;
const rand = () => ((seq = (seq * 16807) % 2147483647) - 1) / 2147483646;
const base = emptyLayout(rand, 6, 4);
const withRows = (rows: string[]): SheetLayout => ({ ...base, rows });
const [a, b, c, d, e, f] = base.rows as [string, string, string, string, string, string];

describe('following rows that move', () => {
  it("moves a selection with its rows, and keeps a deleted line's place", () => {
    const inserted = withRows([a, 'new0000001', b, c, d, e, f]);
    const sel = {
      ranges: [{ r1: 1, c1: 0, r2: 2, c2: 1 }],
      active: { r: 1, c: 0 },
      anchor: { r: 1, c: 0 },
    };
    expect(followSelection(sel, base, inserted)).toEqual({
      ranges: [{ r1: 2, c1: 0, r2: 3, c2: 1 }],
      active: { r: 2, c: 0 },
      anchor: { r: 2, c: 0 },
    });
    const deleted = withRows([a, c, d, e, f]);
    expect(followSelection(single({ r: 1, c: 0 }), base, deleted).active).toEqual({ r: 1, c: 0 });
    expect(followSelection(single({ r: 5, c: 3 }), base, withRows([a, b])).active).toEqual({
      r: 1,
      c: 3,
    });
  });

  function setup(own = false) {
    const setEditing = vi.fn();
    const setSelection = vi.fn();
    const toast = vi.fn();
    let layout = base;
    let editing: { r: number; c: number; draft: string; origin: 'cell' } | null = {
      r: 2,
      c: 1,
      draft: 'x',
      origin: 'cell',
    };
    const view = renderHook(() =>
      useFollowLayout({
        layout,
        editing,
        setEditing,
        selectionNow: () => single({ r: 2, c: 1 }),
        setSelection,
        toast,
        takeOwnLayout: () => own,
      }),
    );
    return {
      setEditing,
      setSelection,
      toast,
      change(next: SheetLayout, edit = editing) {
        layout = next;
        editing = edit;
        view.rerender();
      },
    };
  }

  it('moves an edit in progress with its cell when someone else inserts a row', () => {
    const s = setup();
    s.change(withRows([a, 'new0000001', b, c, d, e, f]));
    expect(s.setEditing).toHaveBeenCalledWith({ r: 3, c: 1, draft: 'x', origin: 'cell' });
    expect(s.setSelection).toHaveBeenCalled();
  });

  it('throws an edit away, and says so, when its row is deleted', () => {
    const s = setup();
    s.change(withRows([a, b, d, e, f]));
    expect(s.setEditing).toHaveBeenCalledWith(null);
    expect(s.toast).toHaveBeenCalledWith(EDIT_LOST);
  });

  it("leaves this person's own layout change alone, and ignores changes that move no line", () => {
    const own = setup(true);
    own.change(withRows([a, 'new0000001', b, c, d, e, f]));
    expect(own.setSelection).not.toHaveBeenCalled();
    const same = setup();
    same.change({ ...base, frozenRows: 1 });
    expect(same.setSelection).not.toHaveBeenCalled();
  });
});
