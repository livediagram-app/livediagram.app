import { beforeEach, describe, expect, it } from 'vitest';
import { APPEARANCE_STORAGE_KEY } from './appearance-storage';
import {
  applyAppearance,
  getAppearanceSetting,
  getResolvedAppearance,
  getServerAppearance,
  readAppearanceSetting,
  resetAppearanceForTests,
  resolveAppearance,
  setAppearance,
  subscribeAppearance,
} from './appearance-store';

// The appearance store: light / dark / system chrome. It persists to
// localStorage, toggles a class on <html>, follows the OS while the user has
// picked System, and is read before paint by a script the root layout inlines.
//
// These run in the node environment, so `window` and `document` are stubs. The
// stubs are the smallest thing the store actually touches: a localStorage pair,
// a classList, and one media query. Anything more elaborate would be testing
// the stub.

type Store = Record<string, string>;
let store: Store = {};
let classes: Set<string>;
/** Every classList call, so a purity check sees a `remove` as well as an `add`. */
let domCalls: string[] = [];
/** The OS preference the matchMedia stub reports, and the listeners on it. */
let osPrefersDark = false;
let mediaListeners: (() => void)[] = [];
/** Queries asked of matchMedia, so a test can assert it was never consulted. */
let mediaQueries: string[] = [];

/** Flip the OS preference and fire the change the way a real MediaQueryList does. */
function setOsPrefersDark(next: boolean): void {
  osPrefersDark = next;
  mediaListeners.forEach((l) => l());
}

beforeEach(() => {
  store = {};
  classes = new Set<string>();
  domCalls = [];
  osPrefersDark = false;
  mediaListeners = [];
  mediaQueries = [];
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
    matchMedia: (query: string) => {
      mediaQueries.push(query);
      return {
        get matches() {
          return osPrefersDark;
        },
        addEventListener: (_: string, l: () => void) => mediaListeners.push(l),
        removeEventListener: (_: string, l: () => void) => {
          mediaListeners = mediaListeners.filter((x) => x !== l);
        },
      };
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
  resetAppearanceForTests();
});

describe('readAppearanceSetting', () => {
  it('is light when nothing has been stored', () => {
    expect(readAppearanceSetting()).toBe('light');
  });

  it('reads back each of the three settings', () => {
    for (const setting of ['light', 'dark', 'system'] as const) {
      store[APPEARANCE_STORAGE_KEY] = setting;
      expect(readAppearanceSetting()).toBe(setting);
    }
  });

  it('falls back to light for anything else at all', () => {
    // A value from an older build, a hand-edited key, a half-written string.
    // None of these should strand the editor in a mode the user cannot
    // explain, and none should throw on the way in.
    for (const junk of ['Dark', 'DARK', ' dark', 'dark ', 'System', 'true', '1', '{}', '']) {
      store[APPEARANCE_STORAGE_KEY] = junk;
      expect(readAppearanceSetting()).toBe('light');
    }
  });

  it('is light on a dark-themed OS until the user asks for System', () => {
    // spec/07: light is the default and the OS is opt-in, so a dark-themed OS
    // must not flip the editor for someone who has never touched the control.
    osPrefersDark = true;
    expect(readAppearanceSetting()).toBe('light');
    expect(resolveAppearance(readAppearanceSetting())).toBe('light');
  });
});

describe('resolveAppearance', () => {
  it('passes an explicit choice straight through, whatever the OS says', () => {
    osPrefersDark = true;
    expect(resolveAppearance('light')).toBe('light');
    osPrefersDark = false;
    expect(resolveAppearance('dark')).toBe('dark');
    // An explicit setting must not even ASK the OS — a needless matchMedia
    // read is how "System" leaks into a choice the user made by hand.
    expect(mediaQueries).toEqual([]);
  });

  it('follows the OS for System', () => {
    osPrefersDark = true;
    expect(resolveAppearance('system')).toBe('dark');
    osPrefersDark = false;
    expect(resolveAppearance('system')).toBe('light');
  });

  it('reads System as light where matchMedia does not exist', () => {
    // Older browsers, jsdom-less test envs, and the server. A missing
    // matchMedia must degrade, not throw.
    delete (globalThis as Record<string, unknown>).window;
    expect(resolveAppearance('system')).toBe('light');
  });
});

describe('setAppearance', () => {
  it('persists each of the three settings', () => {
    for (const setting of ['dark', 'light', 'system'] as const) {
      setAppearance(setting);
      expect(store[APPEARANCE_STORAGE_KEY]).toBe(setting);
    }
  });

  it('adds and removes the dark class on the document element', () => {
    setAppearance('dark');
    expect(classes.has('dark')).toBe(true);
    setAppearance('light');
    expect(classes.has('dark')).toBe(false);
  });

  it('applies the OS preference when the user picks System', () => {
    osPrefersDark = true;
    setAppearance('system');
    expect(classes.has('dark')).toBe(true);
    expect(getResolvedAppearance()).toBe('dark');
    expect(getAppearanceSetting()).toBe('system');
  });

  it('notifies subscribers', () => {
    let calls = 0;
    const off = subscribeAppearance(() => calls++);
    setAppearance('dark');
    expect(calls).toBe(1);
    off();
    setAppearance('light');
    expect(calls).toBe(1);
  });

  it('makes the new value visible to every reader immediately', () => {
    // The whole reason this is a module store: toggling from the status bar
    // must not leave the tab bar reading a stale appearance.
    setAppearance('dark');
    expect(getResolvedAppearance()).toBe('dark');
  });
});

describe('the OS changing under a System setting', () => {
  it('repaints the chrome and notifies subscribers', () => {
    let calls = 0;
    subscribeAppearance(() => calls++);
    setAppearance('system');
    expect(classes.has('dark')).toBe(false);

    setOsPrefersDark(true);
    expect(classes.has('dark')).toBe(true);
    expect(getResolvedAppearance()).toBe('dark');
    // One for the pick, one for the OS change.
    expect(calls).toBe(2);

    setOsPrefersDark(false);
    expect(classes.has('dark')).toBe(false);
    expect(calls).toBe(3);
  });

  it('is ignored once the user picks a side', () => {
    let calls = 0;
    subscribeAppearance(() => calls++);
    setAppearance('dark');
    setOsPrefersDark(false);
    expect(classes.has('dark')).toBe(true);
    expect(getResolvedAppearance()).toBe('dark');
    expect(calls).toBe(1);
  });
});

describe('getAppearanceSetting', () => {
  it('seeds itself from storage on first read', () => {
    store[APPEARANCE_STORAGE_KEY] = 'system';
    expect(getAppearanceSetting()).toBe('system');
  });

  it('does not write anything while reading', () => {
    // getSnapshot must stay pure: useSyncExternalStore calls it during render,
    // and React may call it more than once per render. Asserted on CALLS, not
    // on the resulting state — seeding to 'light' would call
    // classList.remove('dark'), which leaves the class set looking untouched.
    getAppearanceSetting();
    getResolvedAppearance();
    getAppearanceSetting();
    expect(Object.keys(store)).toEqual([]);
    expect(domCalls).toEqual([]);
  });
});

describe('getServerAppearance', () => {
  it('is light whatever the client store holds', () => {
    setAppearance('dark');
    expect(getServerAppearance()).toBe('light');
  });
});

describe('applyAppearance', () => {
  it('is a no-op without a document rather than throwing', () => {
    delete (globalThis as Record<string, unknown>).document;
    expect(() => applyAppearance('dark')).not.toThrow();
  });
});
