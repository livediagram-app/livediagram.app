import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServiceStatusStore, parseServiceStatuses } from './service-status-store';

// docs/specs/009-elements/blueprints/live-status.md "Presentation and UX": the room's states, checked, and the badges'
// clock, which runs only while a state is held and someone reads it.

const URL_A = 'https://status.example.com/';

afterEach(() => {
  vi.useRealTimers();
});

describe('parseServiceStatuses', () => {
  it('keeps well-formed entries with their reason and code', () => {
    expect(
      parseServiceStatuses({
        [URL_A]: { state: 'down', checkedAt: 5, reason: 'http_status', httpStatus: 503 },
        'https://b.example.com/': { state: 'up', checkedAt: 6 },
      }),
    ).toEqual({
      [URL_A]: { state: 'down', checkedAt: 5, reason: 'http_status', httpStatus: 503 },
      'https://b.example.com/': { state: 'up', checkedAt: 6 },
    });
  });

  it('drops anything malformed', () => {
    expect(parseServiceStatuses(null)).toEqual({});
    expect(parseServiceStatuses([])).toEqual({});
    expect(
      parseServiceStatuses({
        a: { state: 'great', checkedAt: 1 },
        b: { state: 'up', checkedAt: Number.NaN },
        c: { state: 'up' },
        d: 'up',
        [`https://x.example.com/${'a'.repeat(2048)}`]: { state: 'up', checkedAt: 1 },
        e: { state: 'down', checkedAt: 1, reason: 'cosmic rays', httpStatus: 1.5 },
      }),
    ).toEqual({ e: { state: 'down', checkedAt: 1 } });
  });
});

describe('createServiceStatusStore', () => {
  it('replaces the states on each receive and tells its readers', () => {
    const store = createServiceStatusStore(() => 100);
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.receive({ [URL_A]: { state: 'up', checkedAt: 90 } });
    expect(store.getSnapshot()).toEqual({
      statuses: { [URL_A]: { state: 'up', checkedAt: 90 } },
      now: 100,
    });
    store.receive({});
    expect(store.getSnapshot().statuses).toEqual({});
    expect(listener).toHaveBeenCalledTimes(2);
    off();
  });

  it('moves the clock while a state is held and someone reads it, and stops after', () => {
    vi.useFakeTimers();
    let t = 0;
    const store = createServiceStatusStore(() => t, 1000);
    const listener = vi.fn();
    // No reader yet: no clock.
    store.receive({ [URL_A]: { state: 'up', checkedAt: 0 } });
    t = 1000;
    vi.advanceTimersByTime(1000);
    expect(store.getSnapshot().now).toBe(0);
    const off = store.subscribe(listener);
    t = 2000;
    vi.advanceTimersByTime(1000);
    expect(store.getSnapshot().now).toBe(2000);
    expect(listener).toHaveBeenCalledTimes(1);
    // Nothing held: the clock stops.
    store.receive({});
    t = 3000;
    vi.advanceTimersByTime(5000);
    expect(store.getSnapshot().now).toBe(2000);
    off();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops the clock when the last reader leaves', () => {
    vi.useFakeTimers();
    const store = createServiceStatusStore(() => 0, 1000);
    store.receive({ [URL_A]: { state: 'up', checkedAt: 0 } });
    const off = store.subscribe(() => {});
    expect(vi.getTimerCount()).toBe(1);
    off();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the same snapshot between changes', () => {
    const store = createServiceStatusStore();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });
});
