import { describe, expect, it } from 'vitest';
import { deriveCatalogue } from '@liveworkspace/settings/catalogue';
import { CATALOGUE } from '@liveworkspace/settings/catalogues/livediagram';
import { DEVICE_PREFERENCES } from '@liveworkspace/settings/device';
import { STORAGE_KEY } from '@/lib/user-preferences';
import { PREFERENCES_UNSYNCED_KEY } from '@/lib/preferences-sync';
import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { SETTINGS_TILES } from './settings-icons';

// liveworkspace.app shows an app's settings from a plain-data copy of its catalogue (packages/settings/src/catalogue.ts).
// livehuddle is held out until launch, so it borrows livediagram's copy and cloud scope (settings-panel-host.tsx); since
// Diagram and Draw mode left (docs/specs/007-editor/editor-modes.md) it has fewer settings than livediagram, so every
// setting it does keep must be one that copy knows, or a change made on the site could never reach this editor. The
// copy is livediagram's to write, never this test's.
const keysOf = (value: unknown, into = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) value.forEach((item) => keysOf(item, into));
  else if (value && typeof value === 'object') {
    for (const [name, child] of Object.entries(value)) {
      if (name === 'key' && typeof child === 'string') into.add(child);
      else keysOf(child, into);
    }
  }
  return into;
};

describe("liveworkspace.app's copy of this app's settings", () => {
  const derived = deriveCatalogue(SETTINGS_CATEGORIES, { tiles: SETTINGS_TILES });

  it('names only settings the borrowed copy knows', () => {
    const known = keysOf(CATALOGUE);
    expect([...keysOf(derived)].filter((key) => !known.has(key))).toEqual([]);
  });

  it('shows at least one setting of its own', () => {
    expect(derived.categories.flatMap((category) => category.rows).length).toBeGreaterThan(0);
  });
});

// The Explorer on this app's address changes a guest's settings in this browser
// (liveworkspace/docs/specs/010-site/site.md "Settings", "A guest"), under the keys liveworkspace keeps for this app. They must
// be this editor's own, or a guest's change there would never reach the editor.
describe("liveworkspace's keys for this app's settings in the browser", () => {
  it('are the editor’s cache and its unsynced mark', () => {
    expect(DEVICE_PREFERENCES['livehuddle.app']).toEqual({
      storageKey: STORAGE_KEY,
      unsyncedKey: PREFERENCES_UNSYNCED_KEY,
    });
  });
});
