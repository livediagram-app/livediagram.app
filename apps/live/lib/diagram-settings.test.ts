// Tests for the per-diagram settings helpers (spec/20). These run
// in the `node` test environment so `window` is undefined by default;
// individual tests stub `globalThis.window` with an in-memory
// Storage shim when they need a real localStorage code path.

import { afterEach, describe, expect, it } from 'vitest';
import { readDiagramSettings, writeDiagramSettings } from './diagram-settings';

// Minimal in-memory `Storage` polyfill. Matches the parts of the
// Web Storage interface diagram-settings actually uses (getItem /
// setItem); the rest are no-ops so the cast to Storage stays safe.
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

// Wire / tear down a fake window with `localStorage`. Returns the
// shim so tests can pre-seed entries or assert on writes.
function mockBrowser(): { storage: Storage; cleanup: () => void } {
  const storage = memoryStorage();
  const win = { localStorage: storage } as unknown as Window;
  (globalThis as { window?: Window }).window = win;
  return {
    storage,
    cleanup: () => {
      delete (globalThis as { window?: Window }).window;
    },
  };
}

afterEach(() => {
  delete (globalThis as { window?: Window }).window;
});

describe('readDiagramSettings (no window)', () => {
  // SSR / static-export build code path. Both helpers degrade to
  // safe no-ops so the diagram page can render server-side without
  // throwing on `localStorage` access.
  it('returns {} when window is undefined', () => {
    expect(readDiagramSettings('d1')).toEqual({});
  });

  it('writeDiagramSettings is a no-op without window (no throw)', () => {
    expect(() => writeDiagramSettings('d1', { autoRebindArrows: false })).not.toThrow();
    expect(readDiagramSettings('d1')).toEqual({});
  });
});

describe('readDiagramSettings (with localStorage)', () => {
  it('returns {} when the key is missing', () => {
    mockBrowser();
    expect(readDiagramSettings('fresh')).toEqual({});
  });

  it('round-trips a valid settings object via write + read', () => {
    mockBrowser();
    writeDiagramSettings('d1', { autoRebindArrows: false });
    expect(readDiagramSettings('d1')).toEqual({ autoRebindArrows: false });
  });

  it('writes the diagrams under distinct keys so settings do not bleed across diagrams', () => {
    mockBrowser();
    writeDiagramSettings('d1', { autoRebindArrows: false });
    writeDiagramSettings('d2', { autoRebindArrows: true });
    expect(readDiagramSettings('d1')).toEqual({ autoRebindArrows: false });
    expect(readDiagramSettings('d2')).toEqual({ autoRebindArrows: true });
  });

  it('returns {} when the stored JSON is malformed (graceful, no throw)', () => {
    const { storage } = mockBrowser();
    storage.setItem('livediagram:diagram-settings:v1:d1', '{not json');
    expect(readDiagramSettings('d1')).toEqual({});
  });

  it('returns {} when the stored value is a non-object JSON literal', () => {
    // A user-tampered string / null / number must not surface as a
    // settings object; the spread-into-{} call site relies on this.
    const { storage } = mockBrowser();
    storage.setItem('livediagram:diagram-settings:v1:d1', '"hello"');
    expect(readDiagramSettings('d1')).toEqual({});
    storage.setItem('livediagram:diagram-settings:v1:d1', 'null');
    expect(readDiagramSettings('d1')).toEqual({});
    storage.setItem('livediagram:diagram-settings:v1:d1', '42');
    expect(readDiagramSettings('d1')).toEqual({});
  });

  it('preserves unknown keys so a future-versioned client does not lose flags it has not seen', () => {
    // Forward-compat guarantee from spec/20: a client that reads a
    // newer client's write should keep the extra keys intact when
    // it writes back, otherwise an older browser tab would
    // silently strip flags the user set in a newer tab.
    const { storage } = mockBrowser();
    storage.setItem(
      'livediagram:diagram-settings:v1:d1',
      JSON.stringify({ autoRebindArrows: false, futureFlag: 'yes' }),
    );
    const read = readDiagramSettings('d1') as { autoRebindArrows?: boolean; futureFlag?: string };
    expect(read.futureFlag).toBe('yes');
    writeDiagramSettings('d1', read);
    const stored = JSON.parse(storage.getItem('livediagram:diagram-settings:v1:d1')!);
    expect(stored).toEqual({ autoRebindArrows: false, futureFlag: 'yes' });
  });

  it('handles an empty object correctly (the every-default-on state)', () => {
    mockBrowser();
    writeDiagramSettings('d1', {});
    expect(readDiagramSettings('d1')).toEqual({});
  });
});

describe('writeDiagramSettings quota / failure handling', () => {
  it('swallows quota errors so the toggle still applies in-memory for the session', () => {
    // setItem throws (QuotaExceededError, private-window restriction,
    // etc). The dialog's local state has already updated; the write
    // failure shouldn't break the next render or surface to the user.
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as unknown as Storage;
    (globalThis as { window?: Window }).window = { localStorage: storage } as unknown as Window;
    expect(() => writeDiagramSettings('d1', { autoRebindArrows: false })).not.toThrow();
  });
});
