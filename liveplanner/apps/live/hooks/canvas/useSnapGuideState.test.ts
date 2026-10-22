// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AlignmentGuide } from '@liveplanner/project';
import { createSnapGuideStore, useSnapGuideState, useSnapGuides } from './useSnapGuideState';

// docs/specs/008-canvas/canvas-performance.md "A move re-renders what moved": the drag's snap guides
// live in a store that only the chrome drawing them reads, and it tells that chrome only on a change.

const guide = (position: number) => ({ axis: 'x', position, start: 0, end: 10 }) as AlignmentGuide;

describe('the snap guide store', () => {
  it('starts empty', () => {
    expect(createSnapGuideStore().get()).toEqual({
      snapGuides: [],
      distGuides: [],
      snapTargets: [],
    });
  });

  it('tells its readers on a new set and keeps the same value for an equal one', () => {
    const store = createSnapGuideStore();
    const told = vi.fn();
    store.subscribe(told);
    store.set({ snapGuides: [guide(5)], distGuides: [] });
    expect(told).toHaveBeenCalledTimes(1);
    const first = store.get();
    store.set({ snapGuides: [guide(5)], distGuides: [] });
    expect(told).toHaveBeenCalledTimes(1);
    expect(store.get()).toBe(first);
  });

  it('keeps the parts a set leaves out', () => {
    const store = createSnapGuideStore();
    store.set({ snapGuides: [guide(5)] });
    const targets = [{ x: 1, y: 2, active: true }];
    store.set({ snapTargets: targets });
    expect(store.get().snapGuides).toEqual([guide(5)]);
    expect(store.get().snapTargets).toBe(targets);
  });

  it('stops telling a reader once it unsubscribes', () => {
    const store = createSnapGuideStore();
    const told = vi.fn();
    store.subscribe(told)();
    store.set({ snapGuides: [guide(1)] });
    expect(told).not.toHaveBeenCalled();
  });
});

describe('scheduling guides', () => {
  it('lands only the latest set, once a frame, for the chrome reading the store', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frames[id - 1] = () => {};
    });
    const { result } = renderHook(() => useSnapGuideState());
    const read = renderHook(() => useSnapGuides(result.current.snapGuideStore));
    act(() => {
      result.current.scheduleGuides([guide(1)]);
      result.current.scheduleGuides([guide(2)]);
      result.current.scheduleSnapTargets([{ x: 1, y: 1, active: false }]);
    });
    expect(read.result.current.snapGuides).toEqual([]);
    act(() => frames.forEach((f) => f(0)));
    expect(read.result.current.snapGuides).toEqual([guide(2)]);
    expect(read.result.current.snapTargets).toEqual([{ x: 1, y: 1, active: false }]);
    vi.unstubAllGlobals();
  });
});
