import { describe, expect, it } from 'vitest';
import { RELOAD_GUARD_KEY, RELOAD_GUARD_WINDOW_MS, claimReload } from './reload-guard';

// docs/specs/016-platform/stale-builds.md "One reload guard": every reload the app or its page
// guard starts on its own claims the same allowance, one per page per window.

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

describe('claimReload', () => {
  it('allows one reload per page within the window, whatever the hash', () => {
    const storage = memoryStorage();
    expect(claimReload('/explorer/trash', storage, 1_000)).toBe(true);
    expect(claimReload('/explorer/trash#top', storage, 2_000)).toBe(false);
    expect(claimReload('/explorer/trash?x=1', storage, 2_000)).toBe(true);
    expect(claimReload('/explorer/trash', storage, 1_000 + RELOAD_GUARD_WINDOW_MS + 1)).toBe(true);
  });

  it('keeps only fresh entries, starts afresh over junk, and refuses when storage throws', () => {
    const storage = memoryStorage();
    claimReload('/a', storage, 0);
    claimReload('/b', storage, RELOAD_GUARD_WINDOW_MS + 10);
    expect(Object.keys(JSON.parse(storage.getItem(RELOAD_GUARD_KEY)!))).toEqual(['/b']);
    storage.setItem(RELOAD_GUARD_KEY, '{not json');
    expect(claimReload('/a', storage, 1)).toBe(true);
    const throwing = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error('denied');
      },
    } as Storage;
    expect(claimReload('/a', throwing, 1)).toBe(false);
  });

  it('is one minute, under the key the chunk recovery has always used', () => {
    expect(RELOAD_GUARD_WINDOW_MS).toBe(60_000);
    expect(RELOAD_GUARD_KEY).toBe('livediagram:stale-chunk-reloads');
  });
});
