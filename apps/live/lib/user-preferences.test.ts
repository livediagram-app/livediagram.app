// Tests for the user-preferences helpers (spec/20). These run in the
// `node` test environment so `window` is undefined by default;
// individual tests stub `globalThis.window` with an in-memory
// Storage shim when they need a real localStorage code path.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api-client', () => ({
  apiGetPreferences: vi.fn(),
  apiPutPreferences: vi.fn(),
}));

import { apiGetPreferences, apiPutPreferences } from './api-client';
import {
  autoRebindArrowsEnabled,
  fetchUserPreferences,
  PREFERENCES_CHANGED_EVENT,
  readUserPreferences,
  STORAGE_KEY,
  writeUserPreferences,
} from './user-preferences';

const mockedGet = vi.mocked(apiGetPreferences);
const mockedPut = vi.mocked(apiPutPreferences);

// "Auto-attach arrows" is opt-in (spec/20): a fresh profile (missing
// key) must read as OFF, and only an explicit true enables the on-move
// rebind pass. This helper is the single home for that default; the
// palette settings popover and useEditorPreferences both consume it,
// so pinning it here pins the shipped behaviour everywhere.
describe('autoRebindArrowsEnabled', () => {
  it('defaults to off for a fresh profile (missing key)', () => {
    expect(autoRebindArrowsEnabled({})).toBe(false);
  });
  it('is on only when explicitly enabled', () => {
    expect(autoRebindArrowsEnabled({ autoRebindArrows: true })).toBe(true);
    expect(autoRebindArrowsEnabled({ autoRebindArrows: false })).toBe(false);
  });
});

// Minimal in-memory `Storage` polyfill. Matches the parts of the
// Web Storage interface this module actually uses (getItem /
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

// Wire / tear down a fake window with `localStorage` + `dispatchEvent`.
// Returns the shim plus a captured-event list so tests can assert that
// writeUserPreferences fired the same-tab `preferences-changed` event.
function mockBrowser(): { storage: Storage; events: string[]; cleanup: () => void } {
  const storage = memoryStorage();
  const events: string[] = [];
  const win = {
    localStorage: storage,
    dispatchEvent: (e: Event) => {
      events.push(e.type);
      return true;
    },
  } as unknown as Window;
  // The constructor for `Event` is only available when running with
  // jsdom; the node environment used here doesn't ship one. Stub it
  // with the minimal shape `writeUserPreferences` relies on.
  vi.stubGlobal(
    'Event',
    class StubEvent {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    },
  );
  (globalThis as { window?: Window }).window = win;
  return {
    storage,
    events,
    cleanup: () => {
      delete (globalThis as { window?: Window }).window;
      vi.unstubAllGlobals();
    },
  };
}

afterEach(() => {
  delete (globalThis as { window?: Window }).window;
  vi.unstubAllGlobals();
});

beforeEach(() => {
  mockedGet.mockReset();
  mockedPut.mockReset();
});

describe('readUserPreferences (no window)', () => {
  // SSR / static-export build code path. Both helpers degrade to
  // safe no-ops so the diagram page can render server-side without
  // throwing on `localStorage` access.
  it('returns {} when window is undefined', () => {
    expect(readUserPreferences()).toEqual({});
  });

  it('writeUserPreferences is a no-op without window (no throw)', () => {
    expect(() => writeUserPreferences({ autoRebindArrows: false })).not.toThrow();
    expect(readUserPreferences()).toEqual({});
  });
});

describe('readUserPreferences (with localStorage)', () => {
  it('returns {} when the key is missing', () => {
    mockBrowser();
    expect(readUserPreferences()).toEqual({});
  });

  it('round-trips a valid preferences object via write + read', () => {
    mockBrowser();
    writeUserPreferences({ autoRebindArrows: false, telemetryEnabled: false });
    expect(readUserPreferences()).toEqual({
      autoRebindArrows: false,
      telemetryEnabled: false,
    });
  });

  it('uses a single shared storage key (no per-diagram suffix anymore)', () => {
    const { storage } = mockBrowser();
    writeUserPreferences({ autoRebindArrows: false });
    // The spec says the key lives at exactly one place; this asserts
    // there's no per-id suffix leakage from the earlier shape.
    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ autoRebindArrows: false }));
  });

  it('returns {} when the stored JSON is malformed (graceful, no throw)', () => {
    const { storage } = mockBrowser();
    storage.setItem(STORAGE_KEY, '{not json');
    expect(readUserPreferences()).toEqual({});
  });

  it('returns {} when the stored value is a non-object JSON literal', () => {
    // A user-tampered string / null / number must not surface as a
    // preferences object; the spread-into-{} call site relies on this.
    const { storage } = mockBrowser();
    storage.setItem(STORAGE_KEY, '"hello"');
    expect(readUserPreferences()).toEqual({});
    storage.setItem(STORAGE_KEY, 'null');
    expect(readUserPreferences()).toEqual({});
    storage.setItem(STORAGE_KEY, '42');
    expect(readUserPreferences()).toEqual({});
  });

  it('preserves unknown keys so a future-versioned client does not lose flags it has not seen', () => {
    // Forward-compat guarantee from spec/20: a client that reads a
    // newer client's write should keep the extra keys intact when it
    // writes back, otherwise an older browser tab would silently
    // strip flags the user set in a newer tab.
    const { storage } = mockBrowser();
    storage.setItem(STORAGE_KEY, JSON.stringify({ autoRebindArrows: false, futureFlag: 'yes' }));
    const read = readUserPreferences() as {
      autoRebindArrows?: boolean;
      futureFlag?: string;
    };
    expect(read.futureFlag).toBe('yes');
    writeUserPreferences(read);
    const stored = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual({ autoRebindArrows: false, futureFlag: 'yes' });
  });

  it('handles an empty object correctly (the every-default-on state)', () => {
    mockBrowser();
    writeUserPreferences({});
    expect(readUserPreferences()).toEqual({});
  });

  it('fires the same-tab preferences-changed event on every successful write', () => {
    const { events } = mockBrowser();
    writeUserPreferences({ telemetryEnabled: false });
    expect(events).toEqual([PREFERENCES_CHANGED_EVENT]);
    writeUserPreferences({ telemetryEnabled: true });
    expect(events).toEqual([PREFERENCES_CHANGED_EVENT, PREFERENCES_CHANGED_EVENT]);
  });
});

// Network-sync helpers introduced in spec/20's "preferences live in D1"
// rewrite. These cover the two interfaces the editor relies on:
// writeUserPreferences(prefs, ownerId) firing a PUT when an owner is
// known (and staying purely local when one isn't), and
// fetchUserPreferences merging the server response over the cache.

describe('writeUserPreferences (server sync)', () => {
  it('fires a PUT to /api/preferences when an owner id is supplied', () => {
    mockBrowser();
    writeUserPreferences({ telemetryEnabled: false }, 'guest-abc');
    expect(mockedPut).toHaveBeenCalledTimes(1);
    expect(mockedPut).toHaveBeenCalledWith('guest-abc', { telemetryEnabled: false });
  });

  it('skips the PUT when no owner id is supplied (legacy / pre-identity callers)', () => {
    mockBrowser();
    writeUserPreferences({ telemetryEnabled: false });
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it('treats a null owner id the same as undefined (no PUT)', () => {
    // Editor-page passes `selfParticipant?.id ?? null` so this branch
    // gets hit before identity resolves on a slow network.
    mockBrowser();
    writeUserPreferences({ autoRebindArrows: false }, null);
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it('still writes to localStorage when the PUT path runs (cache first, sync second)', () => {
    const { storage } = mockBrowser();
    writeUserPreferences({ minimalPanels: true }, 'owner-1');
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}')).toEqual({ minimalPanels: true });
  });
});

describe('fetchUserPreferences', () => {
  it('returns null and leaves the cache untouched when the api call fails', async () => {
    const { storage } = mockBrowser();
    storage.setItem(STORAGE_KEY, JSON.stringify({ autoRebindArrows: false }));
    mockedGet.mockResolvedValueOnce(null);
    const result = await fetchUserPreferences('owner-1');
    expect(result).toBeNull();
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}')).toEqual({ autoRebindArrows: false });
  });

  it('merges the server response over the cache, server wins on conflict', async () => {
    const { storage } = mockBrowser();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ autoRebindArrows: false, telemetryEnabled: true }),
    );
    // Server has telemetryEnabled = false (the user opted out on
    // another device) and a new flag the cache doesn't know about.
    mockedGet.mockResolvedValueOnce({ telemetryEnabled: false, drawToAdd: true });
    const merged = await fetchUserPreferences('owner-1');
    expect(merged).toEqual({
      autoRebindArrows: false, // cache-only key preserved
      telemetryEnabled: false, // server wins on conflict
      drawToAdd: true, // server-only key carried in
    });
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      autoRebindArrows: false,
      telemetryEnabled: false,
      drawToAdd: true,
    });
  });

  it('fires the same-tab preferences-changed event after a successful merge', async () => {
    const { events } = mockBrowser();
    mockedGet.mockResolvedValueOnce({ telemetryEnabled: false });
    await fetchUserPreferences('owner-1');
    expect(events).toEqual([PREFERENCES_CHANGED_EVENT]);
  });

  it('does NOT fire the changed event when the fetch returned null', async () => {
    const { events } = mockBrowser();
    mockedGet.mockResolvedValueOnce(null);
    await fetchUserPreferences('owner-1');
    expect(events).toEqual([]);
  });
});

describe('writeUserPreferences quota / failure handling', () => {
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
    (globalThis as { window?: Window }).window = {
      localStorage: storage,
      dispatchEvent: () => true,
    } as unknown as Window;
    expect(() => writeUserPreferences({ autoRebindArrows: false })).not.toThrow();
  });
});
