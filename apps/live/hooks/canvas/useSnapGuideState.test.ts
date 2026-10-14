import { describe, expect, it, vi } from 'vitest';
import type { AlignmentGuide } from '@livediagram/document';
import { createSnapGuideStore } from './useSnapGuideState';

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
