import { describe, expect, it, vi } from 'vitest';
import { createViewportStore } from './viewport-store';

// docs/specs/008-canvas/blueprints/viewport-store.md "Behaviour and state".

describe('createViewportStore', () => {
  it('starts at the given zoom with no offset', () => {
    expect(createViewportStore(0.6).get()).toEqual({ zoom: 0.6, offset: { x: 0, y: 0 } });
  });

  it('notifies once per real change, with a new view', () => {
    const store = createViewportStore(1);
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.get();

    store.setZoom(2);
    store.setOffset({ x: 5, y: 0 });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.get()).toEqual({ zoom: 2, offset: { x: 5, y: 0 } });
    expect(store.get()).not.toBe(before);
  });

  it('notifies nobody for a set that changes nothing', () => {
    const store = createViewportStore(1);
    store.setOffset({ x: 3, y: 4 });
    const before = store.get();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setZoom(1);
    store.setOffset({ x: 3, y: 4 });
    store.setView({ zoom: 1, offset: { x: 3, y: 4 } });

    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toBe(before);
  });

  it('takes updaters, as setState does', () => {
    const store = createViewportStore(1);
    store.setZoom((z) => z * 2);
    store.setOffset((o) => ({ x: o.x + 1, y: o.y - 1 }));
    expect(store.get()).toEqual({ zoom: 2, offset: { x: 1, y: -1 } });
  });

  it('sets the whole view with one notification', () => {
    const store = createViewportStore(1);
    const listener = vi.fn();
    store.subscribe(listener);
    store.setView({ zoom: 3, offset: { x: 1, y: 2 } });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying a listener that unsubscribed', () => {
    const store = createViewportStore(1);
    const listener = vi.fn();
    store.subscribe(listener)();
    store.setZoom(2);
    expect(listener).not.toHaveBeenCalled();
  });
});
