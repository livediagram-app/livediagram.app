// Tests for the safe localStorage wrappers used by useUiMode,
// useShortcutsEnabled, and user-preferences. These are the
// load-bearing safety nets that turn a "render on the server" or
// "Safari private mode threw" case into a quiet null/no-op rather
// than a crashing throw, so the contract matters more than the
// implementation does.
//
// Runs in the node test environment (`window` undefined by default),
// matching the rest of apps/live's lib tests. Tests that need a
// "real" localStorage stub `globalThis.window` with the same
// memoryStorage shim the user-preferences test uses, so the SSR
// path and the browser-with-storage path are both covered without
// pulling jsdom in just for two functions.

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  writeLocalStorageSafe,
} from './local-storage-safe';

function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => {
      store.delete(k);
    },
    setItem: (k, v) => {
      store.set(k, v);
    },
  };
}

function mockWindow(storage: Storage): { cleanup: () => void } {
  vi.stubGlobal('window', { localStorage: storage } as unknown as Window);
  return {
    cleanup: () => {
      vi.unstubAllGlobals();
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readLocalStorageSafe', () => {
  it('returns null when window is undefined (SSR)', () => {
    // Default node env: no `window`. The function must not throw and
    // must return null so callers can branch on the absence.
    expect(typeof globalThis.window).toBe('undefined');
    expect(readLocalStorageSafe('any-key')).toBeNull();
  });

  it('returns null when the key is missing', () => {
    const storage = memoryStorage();
    mockWindow(storage);
    expect(readLocalStorageSafe('missing')).toBeNull();
  });

  it('returns the stored string when the key is present', () => {
    const storage = memoryStorage();
    storage.setItem('k', 'hello');
    mockWindow(storage);
    expect(readLocalStorageSafe('k')).toBe('hello');
  });

  it('returns null when getItem throws (Safari private mode, storage partitioning)', () => {
    const throwing: Storage = {
      get length() {
        return 0;
      },
      clear: () => undefined,
      getItem: () => {
        throw new Error('SecurityError');
      },
      key: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    };
    mockWindow(throwing);
    expect(() => readLocalStorageSafe('k')).not.toThrow();
    expect(readLocalStorageSafe('k')).toBeNull();
  });
});

describe('writeLocalStorageSafe', () => {
  it('is a silent no-op when window is undefined (SSR)', () => {
    // No `window` to write to; the function must not throw. There's
    // nothing to assert beyond "didn't crash and didn't construct
    // a stray side effect", which is the whole point of the guard.
    expect(typeof globalThis.window).toBe('undefined');
    expect(() => writeLocalStorageSafe('k', 'v')).not.toThrow();
  });

  it('writes the value when storage is available', () => {
    const storage = memoryStorage();
    mockWindow(storage);
    writeLocalStorageSafe('k', 'v');
    expect(storage.getItem('k')).toBe('v');
  });

  it('overwrites a prior value at the same key', () => {
    const storage = memoryStorage();
    storage.setItem('k', 'old');
    mockWindow(storage);
    writeLocalStorageSafe('k', 'new');
    expect(storage.getItem('k')).toBe('new');
  });

  it('silently swallows a setItem throw (quota exceeded, private mode)', () => {
    // The callers (useUiMode / useShortcutsEnabled / user-preferences)
    // all accept "session-only" degradation as their failure mode, so
    // the safety contract here is: a throw never propagates.
    const throwing: Storage = {
      get length() {
        return 0;
      },
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    mockWindow(throwing);
    expect(() => writeLocalStorageSafe('k', 'v')).not.toThrow();
  });
});

describe('removeLocalStorageSafe', () => {
  it('is a silent no-op when window is undefined (SSR)', () => {
    expect(typeof globalThis.window).toBe('undefined');
    expect(() => removeLocalStorageSafe('k')).not.toThrow();
  });

  it('removes the key when storage is available', () => {
    const storage = memoryStorage();
    storage.setItem('k', 'v');
    mockWindow(storage);
    removeLocalStorageSafe('k');
    expect(storage.getItem('k')).toBeNull();
  });

  it('silently swallows a removeItem throw (private mode, partitioning)', () => {
    const throwing: Storage = {
      get length() {
        return 0;
      },
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
    };
    mockWindow(throwing);
    expect(() => removeLocalStorageSafe('k')).not.toThrow();
  });
});
