import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { catalogueSource, deriveCatalogue } from '@liveworkspace/settings/catalogue';
import { CATALOGUE } from '@liveworkspace/settings/catalogues/liveplanner';
import { DEVICE_PREFERENCES } from '@liveworkspace/settings/device';
import { STORAGE_KEY } from '@/lib/user-preferences';
import { PREFERENCES_UNSYNCED_KEY } from '@/lib/preferences-sync';
import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { SETTINGS_TILES } from './settings-icons';

// liveworkspace.app shows this app's own settings in a dialog on its settings page, from a plain-data
// copy of this catalogue (packages/settings/src/catalogue.ts). This keeps the copy in step: change a
// setting here and run this test with UPDATE_SITE_CATALOGUE=1 to write the copy again.
const FILE = fileURLToPath(
  new URL('../../../../../../packages/settings/src/catalogues/liveplanner.ts', import.meta.url),
);

describe("liveworkspace.app's copy of this app's settings", () => {
  const derived = deriveCatalogue(SETTINGS_CATEGORIES, { tiles: SETTINGS_TILES });

  it('matches the catalogue', () => {
    if (process.env.UPDATE_SITE_CATALOGUE) {
      writeFileSync(FILE, catalogueSource('liveplanner', derived));
      expect(readFileSync(FILE, 'utf8')).toContain('CATALOGUE');
      return;
    }
    expect(CATALOGUE).toEqual(derived);
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
    expect(DEVICE_PREFERENCES['liveplanner.app']).toEqual({
      storageKey: STORAGE_KEY,
      unsyncedKey: PREFERENCES_UNSYNCED_KEY,
    });
  });
});
