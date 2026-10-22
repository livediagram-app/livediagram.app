// @vitest-environment jsdom
// A Sheet's cell threads in the Comments panel (docs/specs/029-sheets/sheet.md "Cell comments"): a row each, named
// `Budget!B4` once the Sheet is drawn, "(Deleted Cell)" when the cell is gone, by the Sheet alone before.
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { BoxedElement, Comment } from '@liveplanner/project';
import { commentRowsFromElements } from '@/components/panels/CollaboratePanel';
import { registerCellNamer } from '@/hooks/sheets/sheet-cell-refs';
import { CommentRowItem, useCommentRowLabel } from './CollaborateRows';

afterEach(cleanup);

const c = (id: string, at: number): Comment => ({
  id,
  text: `t ${id}`,
  createdAt: at,
  authorName: 'Priya',
  authorColor: '#000',
});

const sheet = {
  id: 'sh',
  type: 'shape',
  shape: 'plan-sheet',
  x: 0,
  y: 0,
  width: 960,
  height: 560,
  label: 'Budget',
  commentThread: { comments: [c('own', 1)], resolved: false },
  cellComments: {
    'row1:colb': { comments: [c('a', 3)], resolved: false },
    'row2:colb': { comments: [c('b', 2)], resolved: true },
  },
} as unknown as BoxedElement;

describe('cell threads in the Comments panel', () => {
  it('lists each cell thread as its own row beside the Sheet’s', () => {
    const rows = commentRowsFromElements([sheet]);
    expect(rows.map((r) => [r.cell ?? null, r.resolved])).toEqual([
      ['row1:colb', false],
      ['row2:colb', true],
      [null, false],
    ]);
  });

  it('names a row by its cell once the Sheet is drawn', () => {
    const row = { elementId: 'sh', cell: 'row1:colb', label: 'Budget' };
    const { result } = renderHook(() => useCommentRowLabel(row));
    expect(result.current).toBe('Budget');
    let off = () => {};
    act(() => {
      off = registerCellNamer('sh', (cell) => (cell === 'row1:colb' ? 'B4' : null));
    });
    expect(result.current).toBe('Budget!B4');
    const gone = renderHook(() => useCommentRowLabel({ ...row, cell: 'row9:colb' }));
    expect(gone.result.current).toBe('Budget (Deleted Cell)');
    act(() => off());
    expect(result.current).toBe('Budget');
    expect(
      renderHook(() => useCommentRowLabel({ elementId: 'sh', label: 'Budget' })).result.current,
    ).toBe('Budget');
  });

  it('draws the cell’s name on the row', () => {
    const off = registerCellNamer('sh', () => 'C7');
    const [row] = commentRowsFromElements([sheet]);
    render(<CommentRowItem row={row!} index={0} onClick={() => {}} />);
    expect(screen.getByText('Budget!C7')).toBeTruthy();
    off();
  });
});
