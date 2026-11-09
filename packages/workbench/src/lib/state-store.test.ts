import { describe, expect, it, vi } from 'vitest';
import { createStateStore, joinStores, mapStore } from './state-store';

describe('mapStore', () => {
  it('selects once per source value and keeps the result until the source changes', () => {
    const source = createStateStore([1, 2]);
    const select = vi.fn((xs: number[]) => xs.map((x) => x * 2));
    const doubled = mapStore(source, select);
    const first = doubled.get();
    expect(first).toEqual([2, 4]);
    expect(doubled.get()).toBe(first);
    expect(select).toHaveBeenCalledTimes(1);
    source.set([3]);
    expect(doubled.get()).toEqual([6]);
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("notifies through the source's subscription", () => {
    const source = createStateStore(1);
    const listener = vi.fn();
    const off = mapStore(source, (x) => x + 1).subscribe(listener);
    source.set(2);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    source.set(3);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('createStateStore', () => {
  it('starts at the initial value', () => {
    expect(createStateStore(3).get()).toBe(3);
  });

  it('takes a value or an updater and notifies once per change', () => {
    const store = createStateStore(new Map<string, number>());
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(new Map([['a', 1]]));
    store.set((prev) => new Map([...prev, ['b', 2]]));

    expect(listener).toHaveBeenCalledTimes(2);
    expect([...store.get()]).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('notifies nobody when the value is the same one', () => {
    const store = createStateStore({ n: 1 });
    const listener = vi.fn();
    store.subscribe(listener);

    store.set((prev) => prev);
    store.set(store.get());

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying a listener that unsubscribed', () => {
    const store = createStateStore(0);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    store.set(1);

    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toBe(1);
  });
});

describe('joinStores', () => {
  it('reads both as one pair that keeps its identity until either changes', () => {
    const a = createStateStore(1);
    const b = createStateStore('x');
    const joined = joinStores(a, b);
    const first = joined.get();
    expect(first).toEqual([1, 'x']);
    expect(joined.get()).toBe(first);
    a.set(2);
    expect(joined.get()).toEqual([2, 'x']);
    b.set('y');
    expect(joined.get()).toEqual([2, 'y']);
  });

  it('notifies for a change to either, and stops after unsubscribing', () => {
    const a = createStateStore(1);
    const b = createStateStore(1);
    const listener = vi.fn();
    const off = joinStores(a, b).subscribe(listener);
    a.set(2);
    b.set(2);
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    a.set(3);
    b.set(3);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
