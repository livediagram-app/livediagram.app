import { afterEach, describe, expect, it, vi } from 'vitest';
import { collabKeyFor } from '@liveworkspace/api-kit/collab-key';
import { personStore } from '../person-client';
import { testPersonStores } from '../test-person-store';
import type { Env } from '../types';
import { MERGED_GUESTS_KEEP_MS, MERGED_GUESTS_MAX } from './merged-guests';

// The guests an account signed in from (docs/specs/012-collaboration/tab-attendance.md "Closing an account", Work
// Tracker 730): kept as collab keys, newest first, bounded, and past the account's purge only until the alarm.
describe('merged guests', () => {
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const ns = testPersonStores();
    const env = { PERSON_STORE: ns } as unknown as Env;
    return { ns, store: personStore(env, 'user_ada'), raw: ns.get(ns.idFromName('user_ada')) };
  };
  const keys = (n: number) =>
    Promise.all(Array.from({ length: n }, (_, i) => collabKeyFor(`guest_${i}`)));

  it('records each key once, newest first, and keeps at most the cap', async () => {
    vi.useFakeTimers();
    const { store } = setup();
    expect(await store.mergedGuestKeys()).toEqual([]);
    expect(await store.noteMergedGuests([])).toBe(0);
    const all = await keys(MERGED_GUESTS_MAX + 3);
    for (const [i, key] of all.entries()) {
      vi.setSystemTime(1000 + i);
      await store.noteMergedGuests([key, key, 'nope']);
    }
    expect(await store.noteMergedGuests([all.at(-1)!])).toBe(0);
    const kept = await store.mergedGuestKeys();
    expect(kept).toHaveLength(MERGED_GUESTS_MAX);
    expect(kept[0]).toBe(all.at(-1));
    expect(kept).not.toContain(all[0]);
  });

  it('keeps the keys through a purge, arms the alarm, and the alarm deletes the store', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    const { ns, store, raw } = setup();
    const [a, b] = await keys(2);
    await store.noteMergedGuests([a!, b!]);
    await store.createShapeLibrary({ id: 'lib', name: 'Mine', source: 'drawio', items: [] }, 50);
    await store.purge();
    expect(await store.shapeLibraries()).toEqual([]);
    expect((await store.mergedGuestKeys()).sort()).toEqual([a, b].sort());
    expect(ns.alarmOf('user_ada')).toBe(5000 + MERGED_GUESTS_KEEP_MS);
    await (raw as unknown as { alarm(): Promise<void> }).alarm();
    expect(await store.mergedGuestKeys()).toEqual([]);
  });

  it('purges a store with no merged guests whole, with no alarm', async () => {
    const { ns, store } = setup();
    await store.createShapeLibrary({ id: 'lib', name: 'Mine', source: 'drawio', items: [] }, 50);
    await store.purge();
    expect(ns.alarmOf('user_ada')).toBeNull();
    expect(await store.mergedGuestKeys()).toEqual([]);
  });
});
