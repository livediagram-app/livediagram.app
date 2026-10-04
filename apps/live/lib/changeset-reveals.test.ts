import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/document';
import { boundsOfElements, createRevealStore } from './changeset-reveals';

describe('createRevealStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('holds a reveal until its time, telling subscribers both ways', () => {
    const store = createRevealStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.add({
      changesetId: 'cs_1',
      tabId: 't1',
      color: '#f00',
      ids: ['a'],
      until: Date.now() + 2000,
    });
    expect(store.getSnapshot()).toHaveLength(1);
    vi.advanceTimersByTime(1999);
    expect(store.getSnapshot()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(store.getSnapshot()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps one reveal per changeset and clears everything on demand', () => {
    const store = createRevealStore();
    const reveal = {
      changesetId: 'cs_1',
      tabId: 't1',
      color: '#f00',
      ids: ['a'],
      until: Date.now() + 2000,
    };
    store.add(reveal);
    store.add({ ...reveal, ids: ['b'] });
    expect(store.getSnapshot().map((r) => r.ids)).toEqual([['b']]);
    store.clear();
    expect(store.getSnapshot()).toEqual([]);
  });
});

describe('boundsOfElements', () => {
  const box = (id: string, x: number, y: number): Element =>
    ({ id, type: 'shape', shape: 'square', x, y, width: 10, height: 10 }) as Element;

  it('boxes the named elements still present, and answers null for none', () => {
    const elements = [box('a', 0, 0), box('b', 100, 50), box('c', 500, 500)];
    expect(boundsOfElements(elements, ['a', 'b', 'gone'])).toEqual({ x: 0, y: 0, w: 110, h: 60 });
    expect(boundsOfElements(elements, ['gone'])).toBeNull();
  });
});
