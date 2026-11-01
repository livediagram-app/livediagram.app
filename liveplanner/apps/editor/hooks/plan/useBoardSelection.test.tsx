// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { presetSetup, projectBoard, type Item } from '@liveplanner/items';
import { useBoardSelection, type BoardSelectionApi } from './useBoardSelection';

// docs/specs/026-plan/plan-board.md "Several cards at once": a person's own selection on one board.
const track = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({ track: (...a: Parameters<typeof track>) => track(...a) }));

afterEach(() => {
  cleanup();
  track.mockReset();
});

const by = { id: 'p', name: 'P', color: '#000000' };
const card = (id: string, status: string, rank: string): Item => ({
  id,
  type: 'task',
  key: 1,
  rank,
  fields: { title: id, status },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const setup = {
  ...presetSetup('blank'),
  columns: [
    { id: 'todo', status: 'todo', name: 'To do' },
    { id: 'done', status: 'done', name: 'Done' },
  ],
};
const a = card('a', 'todo', 'a');
const b = card('b', 'todo', 'b');
const c = card('c', 'done', 'a');
const board = (...items: Item[]) => projectBoard(setup, new Map(items.map((i) => [i.id, i])));

type Opts = Parameters<typeof useBoardSelection>[0];
const mount = (opts: Partial<Opts> = {}) => {
  const announce = vi.fn();
  const hook = renderHook<BoardSelectionApi, Opts>((props) => useBoardSelection(props), {
    initialProps: {
      projection: board(a, b, c),
      enabled: true,
      selectable: (id: string) => id !== 'hidden',
      announce,
      ...opts,
    },
  });
  return { ...hook, announce };
};

describe('useBoardSelection', () => {
  it('toggles cards, counts them and orders them as the board reads', () => {
    const { result, announce } = mount();
    act(() => result.current.toggle('c'));
    act(() => result.current.toggle('a'));
    expect(result.current.ordered).toEqual(['a', 'c']);
    expect(announce).toHaveBeenLastCalledWith('2 cards selected');
    expect(track).toHaveBeenCalledExactlyOnceWith('Plan', 'Selected', 'Cards');
    act(() => result.current.clear());
    expect(result.current.ids.size).toBe(0);
    expect(announce).toHaveBeenLastCalledWith('Selection cleared');
  });

  it('picks a range in a column, and starts select mode from the menu', () => {
    const { result } = mount();
    act(() => result.current.start('a'));
    expect(result.current.mode).toBe(true);
    act(() => result.current.range('b'));
    expect(result.current.ordered).toEqual(['a', 'b']);
  });

  it('never picks a face-down card, nor anything while disabled', () => {
    const { result, rerender } = mount();
    act(() => result.current.toggle('hidden'));
    act(() => result.current.range('hidden'));
    act(() => result.current.start('hidden'));
    expect(result.current.ids.size).toBe(0);
    act(() => result.current.toggle('a'));
    rerender({ projection: board(a, b, c), enabled: false, selectable: () => true });
    expect(result.current.ids.size).toBe(0);
    act(() => result.current.toggle('b'));
    act(() => result.current.range('b'));
    act(() => result.current.start('b'));
    expect(result.current.ids.size).toBe(0);
  });

  it('lets go of a card the board stops drawing', () => {
    const { result, rerender } = mount();
    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('b'));
    rerender({ projection: board(b, c), enabled: true, selectable: () => true });
    expect(result.current.ordered).toEqual(['b']);
    rerender({ projection: board(a, b, c), enabled: true, selectable: () => true });
    expect(result.current.ordered).toEqual(['b']);
  });

  it('clears on Escape, unless something else took the key', () => {
    const { result } = mount();
    act(() => result.current.toggle('a'));
    const taken = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    taken.preventDefault();
    act(() => void window.dispatchEvent(taken));
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })));
    expect(result.current.ids.size).toBe(1);
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(result.current.ids.size).toBe(0);
  });

  it('holds nothing with no board drawn', () => {
    const { result } = mount({ projection: null });
    act(() => result.current.range('a'));
    expect(result.current.ordered).toEqual([]);
  });
});
