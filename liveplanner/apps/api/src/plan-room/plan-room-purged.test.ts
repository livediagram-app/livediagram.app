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
  it('counts a grant from the purge second as before it, except on a create', () => {
    expect(signedBeforePurge(SECOND - 1, PURGE)).toBe(true);
    expect(signedBeforePurge(SECOND, PURGE)).toBe(true);
    expect(signedBeforePurge(SECOND + 1, PURGE)).toBe(false);
    expect(signedBeforePurge(SECOND - 1, PURGE, true)).toBe(true);
    expect(signedBeforePurge(SECOND, PURGE, true)).toBe(false);
  });

  it('counts a grant with no iat as before', () => {
    expect(signedBeforePurge(undefined, PURGE, true)).toBe(true);
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
});
