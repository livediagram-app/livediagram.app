// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardCollapsedKey } from '@/components/plan/board-collapse';
import { useBoardCollapsed } from './useBoardCollapsed';

const tracked = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track: tracked }));

// docs/specs/026-plan/plan-board.md "Collapse Column": each person's own, remembered per board on this browser.
afterEach(() => {
  localStorage.clear();
  tracked.mockReset();
  vi.restoreAllMocks();
});

const onBoard = new Set(['todo', 'doing', 'done']);

describe('useBoardCollapsed', () => {
  it('collapses and expands a column, remembered for the board and tracked', () => {
    const first = renderHook(() => useBoardCollapsed('b1'));
    act(() => first.result.current.toggleColumn('done', onBoard));
    expect([...first.result.current.columns]).toEqual(['done']);
    expect(tracked).toHaveBeenLastCalledWith('Plan', 'Toggled', 'ColumnCollapsed');
    first.unmount();
    // A reload: the board reads it back; another board has its own.
    const again = renderHook(() => useBoardCollapsed('b1'));
    expect([...again.result.current.columns]).toEqual(['done']);
    expect(renderHook(() => useBoardCollapsed('b2')).result.current.columns.size).toBe(0);
    act(() => again.result.current.toggleColumn('done', onBoard));
    expect(again.result.current.columns.size).toBe(0);
    expect(tracked).toHaveBeenLastCalledWith('Plan', 'Toggled', 'ColumnExpanded');
    // Nothing collapsed leaves nothing stored.
    expect(localStorage.getItem(boardCollapsedKey('b1'))).toBeNull();
  });

  it('remembers its swimlanes with its columns, and drops a column no longer on the board', () => {
    localStorage.setItem(boardCollapsedKey('b1'), JSON.stringify({ columns: ['gone'] }));
    const { result } = renderHook(() => useBoardCollapsed('b1'));
    act(() => result.current.toggleLane('sam'));
    act(() => result.current.toggleColumn('todo', onBoard));
    expect([...result.current.lanes]).toEqual(['sam']);
    expect([...result.current.columns]).toEqual(['todo']);
    expect(JSON.parse(localStorage.getItem(boardCollapsedKey('b1'))!)).toEqual({
      columns: ['todo'],
      lanes: ['sam'],
    });
  });

  it('reads afresh when the board under it changes', () => {
    localStorage.setItem(boardCollapsedKey('b2'), JSON.stringify({ columns: ['done'] }));
    const { result, rerender } = renderHook(({ id }) => useBoardCollapsed(id), {
      initialProps: { id: 'b1' },
    });
    expect(result.current.columns.size).toBe(0);
    rerender({ id: 'b2' });
    expect([...result.current.columns]).toEqual(['done']);
  });

  it('keeps it for the session when the browser refuses storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => useBoardCollapsed('b1'));
    act(() => result.current.toggleColumn('todo', onBoard));
    expect([...result.current.columns]).toEqual(['todo']);
  });
});
