// @vitest-environment jsdom
// The board's filter, shared and kept (docs/specs/026-plan/board-widgets.md "The board's filter"; Work Tracker 842):
// two people on one board converge on one filter, a remount (a tab switch, a reload) shows it again, typing is written
// once it pauses, and a Viewer only sees it.
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOARD_FILTER_TYPING_MS, type BoardFilter } from '@liveplanner/items';
import { useBoardFilter } from './useBoardFilter';

const NO_FINISHED: readonly string[] = [];

// One board's stored set-up, as the room keeps it for everyone: each write lands, and every client re-reads it.
function sharedBoard() {
  let stored: BoardFilter | undefined;
  const listeners = new Set<() => void>();
  const writes: (BoardFilter | undefined)[] = [];
  return {
    get: () => stored,
    writes,
    write: (f: BoardFilter | undefined) => {
      stored = f;
      writes.push(f);
      for (const l of listeners) l();
    },
    listen: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

// One person with the board open: their id and whether they may change the filter.
function client(board: ReturnType<typeof sharedBoard>, mine: string, canChange = true) {
  const hook = renderHook(
    ({ stored }) =>
      useBoardFilter({
        stored,
        mine,
        today: 20_000,
        soonDays: 2,
        finished: NO_FINISHED,
        canChange,
        write: board.write,
      }),
    { initialProps: { stored: board.get() } },
  );
  const stop = board.listen(() => hook.rerender({ stored: board.get() }));
  return { ...hook, stop };
}

describe('useBoardFilter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('two people on one board converge: a chip or Only Mine one presses shows for the other at once', () => {
    const board = sharedBoard();
    const ann = client(board, 'ann');
    const bob = client(board, 'bob');
    act(() => ann.result.current.setQuick({ type: 'bug', mine: 'ann' }));
    // Only Mine is shared on or off; each sees their own cards.
    expect(ann.result.current.quick).toEqual({ type: 'bug', mine: 'ann' });
    expect(bob.result.current.quick).toEqual({ type: 'bug', mine: 'bob' });
    act(() => bob.result.current.setQuick({}));
    expect(ann.result.current.quick).toEqual({});
    expect(board.get()).toBeUndefined();
  });

  it('writes typing once it pauses, never per keystroke, showing the draft meanwhile', () => {
    const board = sharedBoard();
    const ann = client(board, 'ann');
    const bob = client(board, 'bob');
    for (const text of ['l', 'lo', 'log', 'login ']) {
      act(() => ann.result.current.setQuick({ ...ann.result.current.quick, text }));
    }
    expect(ann.result.current.quick.text).toBe('login ');
    expect(board.writes).toHaveLength(0);
    expect(bob.result.current.quick).toEqual({});
    act(() => {
      vi.advanceTimersByTime(BOARD_FILTER_TYPING_MS);
    });
    expect(board.writes).toEqual([{ text: 'login ' }]);
    // The trailing space survives the round trip, so the next word is typed on.
    expect(ann.result.current.quick.text).toBe('login ');
    expect(bob.result.current.quick.text).toBe('login ');
  });

  it('writes waiting words with the next press, in one write', () => {
    const board = sharedBoard();
    const ann = client(board, 'ann');
    act(() => ann.result.current.setQuick({ text: 'api' }));
    act(() => ann.result.current.setQuick({ ...ann.result.current.quick, priority: 'high' }));
    expect(board.writes).toEqual([{ text: 'api', priority: 'high' }]);
    act(() => {
      vi.advanceTimersByTime(BOARD_FILTER_TYPING_MS);
    });
    expect(board.writes).toHaveLength(1);
  });

  it('is there again after a tab switch or a reload (a remount reads the kept filter)', () => {
    const board = sharedBoard();
    const ann = client(board, 'ann');
    act(() => ann.result.current.setQuick({ filters: [{ by: 'type', key: 'bug' }] }));
    ann.stop();
    ann.unmount();
    const again = client(board, 'ann');
    expect(again.result.current.quick).toEqual({ filters: [{ by: 'type', key: 'bug' }] });
  });

  it('writes the words still waiting when the board leaves the screen mid-word', () => {
    const board = sharedBoard();
    const ann = client(board, 'ann');
    act(() => ann.result.current.setQuick({ text: 'half' }));
    ann.stop();
    ann.unmount();
    expect(board.writes).toEqual([{ text: 'half' }]);
    // Nothing waiting: leaving writes nothing.
    const bob = client(board, 'bob');
    bob.unmount();
    expect(board.writes).toHaveLength(1);
  });

  it('Show All clears the board at once, words and chips, with no pause to wait for', () => {
    const board = sharedBoard();
    const ann = client(board, 'ann');
    const bob = client(board, 'bob');
    act(() => ann.result.current.setQuick({ text: 'zzz', priority: 'high' }));
    act(() => ann.result.current.setQuick({ text: 'zzz' }));
    board.writes.length = 0;
    act(() => bob.result.current.showAll());
    expect(board.writes).toEqual([undefined]);
    expect(ann.result.current.quick).toEqual({});
  });

  it("a Viewer sees the board's filter and cannot change it", () => {
    const board = sharedBoard();
    board.write({ text: 'login', mine: true });
    board.writes.length = 0;
    const viewer = client(board, 'val', false);
    expect(viewer.result.current.quick).toEqual({ text: 'login', mine: 'val' });
    act(() => viewer.result.current.setQuick({}));
    act(() => viewer.result.current.showAll());
    act(() => viewer.result.current.setQuick({ text: 'x', mine: 'val' }));
    act(() => {
      vi.advanceTimersByTime(BOARD_FILTER_TYPING_MS);
    });
    expect(board.writes).toHaveLength(0);
    expect(viewer.result.current.quick).toEqual({ text: 'login', mine: 'val' });
  });
});
