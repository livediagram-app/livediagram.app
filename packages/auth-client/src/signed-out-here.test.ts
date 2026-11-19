import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  noteSignedOutHere,
  SIGNED_OUT_HERE_FRESH_MS,
  SIGNED_OUT_HERE_KEY,
  takeSignedOutHere,
} from './signed-out-here';

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

let store: Storage;
beforeEach(() => {
  store = memoryStorage();
  vi.stubGlobal('sessionStorage', store);
});
afterEach(() => vi.unstubAllGlobals());

describe('signed out of this app only', () => {
  it('is taken once, by the page that lands a moment later', () => {
    noteSignedOutHere(1_000);
    expect(store.getItem(SIGNED_OUT_HERE_KEY)).toBe('{"at":1000}');
    expect(takeSignedOutHere(2_000)).toBe(true);
    expect(store.getItem(SIGNED_OUT_HERE_KEY)).toBeNull();
    expect(takeSignedOutHere(2_000)).toBe(false);
  });

  it('notes the time now by default', () => {
    noteSignedOutHere();
    expect(takeSignedOutHere()).toBe(true);
  });

  it('drops a note no page took in time, or one from the future', () => {
    noteSignedOutHere(0);
    expect(takeSignedOutHere(SIGNED_OUT_HERE_FRESH_MS)).toBe(false);
    expect(store.getItem(SIGNED_OUT_HERE_KEY)).toBeNull();
    noteSignedOutHere(5_000);
    expect(takeSignedOutHere(4_000)).toBe(false);
  });

  it('drops a note it cannot read', () => {
    for (const raw of ['nope', 'null', '{"at":"1"}', '{}']) {
      store.setItem(SIGNED_OUT_HERE_KEY, raw);
      expect(takeSignedOutHere(0)).toBe(false);
      expect(store.getItem(SIGNED_OUT_HERE_KEY)).toBeNull();
    }
  });

  it('has nothing to say, and throws nothing, when sessionStorage is missing or blocked', () => {
    vi.stubGlobal('sessionStorage', undefined);
    noteSignedOutHere();
    expect(takeSignedOutHere()).toBe(false);

    const blocked = {
      setItem: () => {
        throw new Error('blocked');
      },
      getItem: () => {
        throw new Error('blocked');
      },
    };
    vi.stubGlobal('sessionStorage', blocked);
    expect(() => noteSignedOutHere()).not.toThrow();
    expect(takeSignedOutHere()).toBe(false);

    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(() => noteSignedOutHere()).not.toThrow();
      expect(takeSignedOutHere()).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        writable: true,
        value: store,
      });
    }
  });
});
