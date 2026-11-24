// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAGNIFIER_CONFIG, type MagnifierConfig } from './magnifier-config';
import { createMagnifierStore, MAGNIFIER_TELEMETRY_DEBOUNCE_MS } from './magnifier-store';

// docs/specs/008-canvas/magnifier.md "Persistence" and "Telemetry".
describe('magnifier store', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = (stored: MagnifierConfig = DEFAULT_MAGNIFIER_CONFIG) => {
    const saved: MagnifierConfig[] = [];
    const reported: string[] = [];
    const load = vi.fn(() => stored);
    const store = createMagnifierStore({
      load,
      save: (c) => saved.push(c),
      report: (field) => reported.push(field),
    });
    return { store, saved, reported, load };
  };

  it('reads what was stored, once, on first use', () => {
    const { store, load } = make({ zoom: 3, size: 160, shape: 'round' });
    expect(load).not.toHaveBeenCalled();
    expect(store.get()).toEqual({ zoom: 3, size: 160, shape: 'round' });
    store.get();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('saves each change at once and tells its subscribers', () => {
    const { store, saved } = make();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.set('shape', 'round');
    expect(store.get().shape).toBe('round');
    expect(saved.at(-1)).toEqual({ ...DEFAULT_MAGNIFIER_CONFIG, shape: 'round' });
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    store.set('shape', 'square');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clamps whatever it is given, and ignores a change to the same value', () => {
    const { store, saved } = make();
    store.set('zoom', 50);
    expect(store.get().zoom).toBe(6);
    store.set('size', 10);
    expect(store.get().size).toBe(120);
    const writes = saved.length;
    store.set('size', 120);
    expect(saved.length).toBe(writes);
  });

  it('reports a burst of changes to one field once it settles', () => {
    const { store, reported } = make();
    for (let i = 0; i < 20; i++) store.set('zoom', 2 + i * 0.1);
    store.set('size', 300);
    expect(reported).toEqual([]);
    vi.advanceTimersByTime(MAGNIFIER_TELEMETRY_DEBOUNCE_MS);
    expect(reported.sort()).toEqual(['size', 'zoom']);
  });

  it('sends a pending report when the page is hidden', () => {
    const { store, reported } = make();
    store.set('shape', 'round');
    window.dispatchEvent(new Event('pagehide'));
    expect(reported).toEqual(['shape']);
    vi.advanceTimersByTime(MAGNIFIER_TELEMETRY_DEBOUNCE_MS);
    expect(reported).toEqual(['shape']);
  });
});
