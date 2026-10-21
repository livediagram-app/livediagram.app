import { describe, expect, it, vi } from 'vitest';
import {
  EMPTY_SELECTION,
  createSelectionStore,
  selectionIds,
  elementSelectionFlags,
  sameFlags,
} from './selection-store';

// docs/specs/008-canvas/blueprints/selection-store.md "The store".

describe('createSelectionStore', () => {
  it('starts empty, with a frozen empty selection', () => {
    const store = createSelectionStore();

    expect(store.get()).toBe(EMPTY_SELECTION);
    expect(Object.isFrozen(EMPTY_SELECTION)).toBe(true);
  });

  it('notifies once per real change and hands out a new snapshot', () => {
    const store = createSelectionStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setSelectedId('a');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual({ selectedId: 'a', multiSelectedIds: new Set() });
    expect(store.get()).not.toBe(EMPTY_SELECTION);
  });

  it('notifies nobody for a set that changes nothing', () => {
    const store = createSelectionStore();
    store.setSelectedId('a');
    store.setMultiSelectedIds(new Set(['x', 'y']));
    const before = store.get();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setSelectedId('a');
    store.setMultiSelectedIds(new Set(['y', 'x']));
    store.setSelection({ selectedId: 'a', multiSelectedIds: new Set(['x', 'y']) });

    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toBe(before);
  });

  it('treats a fresh empty set over an empty set as no change', () => {
    const store = createSelectionStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setMultiSelectedIds(new Set());

    expect(listener).not.toHaveBeenCalled();
  });

  it('takes updaters, as setState does, each seeing the latest value', () => {
    const store = createSelectionStore();

    store.setMultiSelectedIds((prev) => new Set([...prev, 'a']));
    store.setMultiSelectedIds((prev) => new Set([...prev, 'b']));
    store.setSelectedId((prev) => (prev === null ? 'c' : prev));

    expect([...store.get().multiSelectedIds]).toEqual(['a', 'b']);
    expect(store.get().selectedId).toBe('c');
  });

  it('sets both halves with one notification', () => {
    const store = createSelectionStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setSelection({ selectedId: null, multiSelectedIds: new Set(['a', 'b']) });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get().multiSelectedIds.size).toBe(2);
  });

  it('stops notifying a listener once it unsubscribes', () => {
    const store = createSelectionStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.setSelectedId('a');

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps stores apart', () => {
    const one = createSelectionStore();
    const two = createSelectionStore();

    one.setSelectedId('a');

    expect(two.get().selectedId).toBeNull();
  });
});

describe('elementSelectionFlags', () => {
  it('reads a single selection', () => {
    const s = { selectedId: 'a', multiSelectedIds: new Set<string>() };

    expect(elementSelectionFlags(s, 'a')).toEqual({ selected: true, multi: false, single: true });
    expect(elementSelectionFlags(s, 'b')).toEqual({ selected: false, multi: false, single: false });
  });

  it('reads a multi-selection, where no element is single', () => {
    const s = { selectedId: 'a', multiSelectedIds: new Set(['a', 'b']) };

    expect(elementSelectionFlags(s, 'a')).toEqual({ selected: true, multi: true, single: false });
    expect(elementSelectionFlags(s, 'b')).toEqual({ selected: true, multi: true, single: false });
  });

  it('compares flags by value', () => {
    expect(
      sameFlags(
        { selected: true, multi: false, single: true },
        { selected: true, multi: false, single: true },
      ),
    ).toBe(true);
    expect(
      sameFlags(
        { selected: true, multi: false, single: true },
        { selected: true, multi: true, single: false },
      ),
    ).toBe(false);
  });
});

describe('selectionIds', () => {
  it('is the multi-selection when there is one, else the single id, else nothing', () => {
    expect([...selectionIds('a', new Set(['b', 'c']))]).toEqual(['b', 'c']);
    expect([...selectionIds('a', new Set())]).toEqual(['a']);
    expect(selectionIds(null, new Set()).size).toBe(0);
  });
});
