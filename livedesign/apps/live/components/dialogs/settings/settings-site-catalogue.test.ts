import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { catalogueSource, deriveCatalogue } from '@liveworkspace/settings/catalogue';
import { CATALOGUE } from '@liveworkspace/settings/catalogues/livedesign';
import { SETTINGS_CATEGORIES } from './settings-catalogue';

// liveworkspace.app shows this app's own settings in a dialog on its settings page, from a plain-data
// copy of this catalogue (packages/settings/src/catalogue.ts). This keeps the copy in step: change a
// setting here and run this test with UPDATE_SITE_CATALOGUE=1 to write the copy again.
const FILE = fileURLToPath(
  new URL('../../../../../../packages/settings/src/catalogues/livedesign.ts', import.meta.url),
);

describe("liveworkspace.app's copy of this app's settings", () => {
  const derived = deriveCatalogue(SETTINGS_CATEGORIES);

  it('matches the catalogue', () => {
    if (process.env.UPDATE_SITE_CATALOGUE) {
      writeFileSync(FILE, catalogueSource('livedesign', derived));
      expect(readFileSync(FILE, 'utf8')).toContain('CATALOGUE');
      return;
    }
    expect(CATALOGUE).toEqual(derived);
  });

  it('shows at least one setting of its own', () => {
    expect(derived.categories.flatMap((category) => category.rows).length).toBeGreaterThan(0);
  });
});
