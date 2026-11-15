import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  admitAfterPurge,
  PURGED_KEY,
  signedBeforePurge,
  type PurgedRoom,
} from './plan-room-purged';

// docs/specs/015-api/api.md "A purged room stays purged": which grants a purged room still refuses.

const PURGE = 1_700_000_000_500; // ms, half way through second 1_700_000_000
const SECOND = 1_700_000_000;

function roomOf(stored: Map<string, unknown>, schema = false): PurgedRoom {
  return {
    state: {
      storage: {
        get: (async (key: string) => stored.get(key)) as PurgedRoom['state']['storage']['get'],
        put: (async (key: string, value: unknown) =>
          void stored.set(key, value)) as PurgedRoom['state']['storage']['put'],
        delete: (async (key: string) =>
          stored.delete(key)) as PurgedRoom['state']['storage']['delete'],
      },
    },
    storedSchema: () => schema,
    purgedAt: undefined,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('signedBeforePurge', () => {
  it('with whole seconds only, counts a grant from the purge second as before it, except on a create', () => {
    expect(signedBeforePurge({ iat: SECOND - 1 }, PURGE)).toBe(true);
    expect(signedBeforePurge({ iat: SECOND }, PURGE)).toBe(true);
    expect(signedBeforePurge({ iat: SECOND + 1 }, PURGE)).toBe(false);
    expect(signedBeforePurge({ iat: SECOND - 1 }, PURGE, true)).toBe(true);
    expect(signedBeforePurge({ iat: SECOND }, PURGE, true)).toBe(false);
  });

  // Work Tracker 830: the purge's own second split by the millisecond, a create's grant included.
  it('to the millisecond, refuses every grant signed before the purge, inside its second too', () => {
    expect(signedBeforePurge({ iat: SECOND, iatMs: PURGE - 1 }, PURGE)).toBe(true);
    expect(signedBeforePurge({ iat: SECOND, iatMs: PURGE - 1 }, PURGE, true)).toBe(true);
    expect(signedBeforePurge({ iat: SECOND, iatMs: PURGE }, PURGE)).toBe(false);
    expect(signedBeforePurge({ iat: SECOND, iatMs: PURGE + 1 }, PURGE, true)).toBe(false);
    // The millisecond wins over the second it sits in.
    expect(signedBeforePurge({ iat: SECOND - 1, iatMs: SECOND * 1000 - 1 }, PURGE, true)).toBe(
      true,
    );
  });

  it('counts a grant with no iat as before', () => {
    expect(signedBeforePurge({}, PURGE, true)).toBe(true);
  });
});

describe('admitAfterPurge', () => {
  it('admits anything on a room that was never purged, reading the mark once', async () => {
    const room = roomOf(new Map());
    const get = vi.spyOn(room.state.storage, 'get');
    expect(await admitAfterPurge(room, null)).toBe(true);
    expect(await admitAfterPurge(room, null)).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('never reads the mark on a room holding a plan', async () => {
    const room = roomOf(new Map([[PURGED_KEY, PURGE]]), true);
    const get = vi.spyOn(room.state.storage, 'get');
    expect(await admitAfterPurge(room, { iat: SECOND - 60 })).toBe(true);
    expect(get).not.toHaveBeenCalled();
  });

  it('refuses no grant and a same-second read, then lifts the mark for a same-second create', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const stored = new Map<string, unknown>([[PURGED_KEY, PURGE]]);
    const room = roomOf(stored);
    expect(await admitAfterPurge(room, null)).toBe(false);
    expect(await admitAfterPurge(room, { iat: SECOND })).toBe(false);
    expect(await admitAfterPurge(room, { iat: SECOND }, true)).toBe(true);
    expect(stored.has(PURGED_KEY)).toBe(false);
    expect(await admitAfterPurge(room, { iat: SECOND - 60 })).toBe(true);
  });

  it('refuses a same-second create signed before the purge, and lifts the mark for one signed after it', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const stored = new Map<string, unknown>([[PURGED_KEY, PURGE]]);
    const room = roomOf(stored);
    expect(await admitAfterPurge(room, { iat: SECOND, iatMs: PURGE - 200 }, true)).toBe(false);
    expect(stored.has(PURGED_KEY)).toBe(true);
    expect(await admitAfterPurge(room, { iat: SECOND, iatMs: PURGE + 50 }, true)).toBe(true);
    expect(stored.has(PURGED_KEY)).toBe(false);
  });
});
