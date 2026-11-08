import { describe, expect, it, vi } from 'vitest';
import { createStateStore } from './state-store';

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
