// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape } from '@livediagram/document';
import { isReplayActive, replayStore, useReplayState } from './replay-store';
import { frozen, useReplayFreeze } from './useReplayFreeze';

// Watch It Built's own state and its write freeze (docs/specs/007-editor/blueprints/watch-it-built.md "The scope",
// "The freeze"): nothing it draws is ever in the document, and nothing written while it runs reaches it.

afterEach(() => replayStore.reset());

describe('replayStore', () => {
  it('notifies on a change only, and reset ends the run with its selection', () => {
    const heard = vi.fn();
    const off = replayStore.subscribe(heard);
    replayStore.set({ active: true });
    replayStore.set({ active: true });
    expect(heard).toHaveBeenCalledTimes(1);
    expect(isReplayActive()).toBe(true);

    replayStore.selection.setSelection({ selectedId: 'wib-a', multiSelectedIds: new Set() });
    replayStore.reset();
    expect(isReplayActive()).toBe(false);
    expect(replayStore.get()).toEqual({ active: false, elements: [], menu: null });
    expect(replayStore.selection.get().selectedId).toBeNull();
    expect(heard).toHaveBeenCalledTimes(2);
    replayStore.reset();
    expect(heard).toHaveBeenCalledTimes(2);
    off();
  });

  it('hands React the current state', () => {
    const { result } = renderHook(() => useReplayState());
    expect(result.current.active).toBe(false);
    const el = { ...createShape('square', 0, 0), id: 'wib-a' };
    act(() => replayStore.set({ active: true, elements: [el] }));
    expect(result.current).toMatchObject({ active: true, elements: [el] });
  });
});

describe('the freeze', () => {
  it('drops a write while a replay runs and passes it through otherwise', () => {
    const write = vi.fn();
    const guarded = frozen('commit', write);
    guarded('one');
    replayStore.set({ active: true });
    guarded('two');
    replayStore.reset();
    guarded('three');
    expect(write.mock.calls).toEqual([['one'], ['three']]);
  });

  it('wraps all four history writers, stable while they are', () => {
    const writers = { commit: vi.fn(), tick: vi.fn(), undo: vi.fn(), redo: vi.fn() };
    const { result, rerender } = renderHook(() => useReplayFreeze(writers));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    replayStore.set({ active: true });
    first.commit();
    first.tick();
    first.undo();
    first.redo();
    for (const w of Object.values(writers)) expect(w).not.toHaveBeenCalled();
    replayStore.reset();
    first.undo();
    expect(writers.undo).toHaveBeenCalledTimes(1);
  });
});
