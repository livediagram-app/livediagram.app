import { beforeEach, describe, expect, it } from 'vitest';
import { UI_MODE_STORAGE_KEY } from './ui-mode-storage';
import {
  applyUiMode,
  getServerUiMode,
  getUiMode,
  readUiMode,
  resetUiModeForTests,
  setUiMode,
  subscribeUiMode,
} from './ui-mode-store';

// The light/dark chrome store. It persists to localStorage, toggles a class on
// <html>, and is read before paint by a script the root layout inlines — three
// side effects and no test until now.
//
// These run in the node environment, so `window` and `document` are stubs. The
// stubs are the smallest thing the store actually touches: a localStorage pair
// and a classList. Anything more elaborate would be testing the stub.

type Store = Record<string, string>;
let store: Store = {};
let classes: Set<string>;
/** Every classList call, so a purity check sees a `remove` as well as an `add`. */
let domCalls: string[] = [];

beforeEach(() => {
  store = {};
  classes = new Set<string>();
  domCalls = [];
  const g = globalThis as Record<string, unknown>;
  g.window = {
    localStorage: {
      getItem: (k: string) => (k in store ? store[k]! : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    },
  };
  g.document = {
    documentElement: {
      classList: {
        add: (c: string) => {
          domCalls.push(`add:${c}`);
          classes.add(c);
        },
        remove: (c: string) => {
          domCalls.push(`remove:${c}`);
          classes.delete(c);
        },
      },
    },
  };
  resetUiModeForTests();
});

describe('readUiMode', () => {
  it('is light when nothing has been stored', () => {
    expect(readUiMode()).toBe('light');
  });

  it('is dark only for the exact literal', () => {
    store[UI_MODE_STORAGE_KEY] = 'dark';
    expect(readUiMode()).toBe('dark');
  });

  it('falls back to light for anything else at all', () => {
    // A value from an older build, a hand-edited key, a half-written string.
    // None of these should strand the editor in a mode the user cannot
    // explain, and none should throw on the way in.
    for (const junk of ['Dark', 'DARK', ' dark', 'dark ', 'true', '1', '{}', '']) {
      store[UI_MODE_STORAGE_KEY] = junk;
      expect(readUiMode()).toBe('light');
    }
  });

  it('never consults the OS preference', () => {
    // spec/07: the toggle is opt-in, so a dark-themed OS must not flip the
    // editor on first load. Asserted by construction — a prefers-color-scheme
    // read would need matchMedia, which these stubs deliberately omit, so this
    // suite would throw rather than pass if one were added.
    expect((globalThis as Record<string, unknown>).matchMedia).toBeUndefined();
    expect(readUiMode()).toBe('light');
  });
});

describe('setUiMode', () => {
  it('persists the choice', () => {
    setUiMode('dark');
    expect(store[UI_MODE_STORAGE_KEY]).toBe('dark');
    setUiMode('light');
    expect(store[UI_MODE_STORAGE_KEY]).toBe('light');
  });

  it('adds and removes the dark class on the document element', () => {
    setUiMode('dark');
    expect(classes.has('dark')).toBe(true);
    setUiMode('light');
    expect(classes.has('dark')).toBe(false);
  });

  it('notifies subscribers', () => {
    let calls = 0;
    const off = subscribeUiMode(() => calls++);
    setUiMode('dark');
    expect(calls).toBe(1);
    off();
    setUiMode('light');
    expect(calls).toBe(1);
  });

  it('makes the new value visible to every reader immediately', () => {
    // The whole reason this is a module store: toggling from the status bar
    // must not leave the tab bar reading a stale mode.
    setUiMode('dark');
    expect(getUiMode()).toBe('dark');
  });
});

describe('getUiMode', () => {
  it('seeds itself from storage on first read', () => {
    store[UI_MODE_STORAGE_KEY] = 'dark';
    expect(getUiMode()).toBe('dark');
  });

  it('does not write anything while reading', () => {
    // getSnapshot must stay pure: useSyncExternalStore calls it during render,
    // and React may call it more than once per render. Asserted on CALLS, not
    // on the resulting state — seeding to 'light' would call
    // classList.remove('dark'), which leaves the class set looking untouched.
    getUiMode();
    getUiMode();
    expect(Object.keys(store)).toEqual([]);
    expect(domCalls).toEqual([]);
  });
});

describe('getServerUiMode', () => {
  it('is light whatever the client store holds', () => {
    setUiMode('dark');
    expect(getServerUiMode()).toBe('light');
  });
});

describe('applyUiMode', () => {
  it('is a no-op without a document rather than throwing', () => {
    delete (globalThis as Record<string, unknown>).document;
    expect(() => applyUiMode('dark')).not.toThrow();
  });
});
