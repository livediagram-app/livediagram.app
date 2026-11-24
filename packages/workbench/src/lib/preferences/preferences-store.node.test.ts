// Outside a browser (a static page being built): nothing to keep, nothing to hear, and no listeners added.
import { describe, expect, it, vi } from 'vitest';
import { createPreferencesStore } from './preferences-store';

describe('the preferences store outside a browser', () => {
  it('reads empty and writes without throwing', () => {
    const put = vi.fn();
    const store = createPreferencesStore<Record<string, unknown>>({
      storageKey: 'k',
      unsyncedKey: 'u',
      serverKey: 's',
      changedEvent: 'e',
      upgrade: (raw) => raw,
      fit: (prefs) => prefs,
      get: vi.fn(),
      put,
      debounceMs: 400,
    });
    expect(store.read()).toEqual({});
    expect(() => store.write({ a: 1 })).not.toThrow();
    store.reset();
  });
});
