import { describe, expect, it } from 'vitest';
import { commonCatalogue } from '@liveworkspace/settings/common';
import { CATALOGUE as LIVEHUDDLE } from '@liveworkspace/settings/catalogues/livehuddle';
import { CATALOGUE as LIVEPLANNER } from '@liveworkspace/settings/catalogues/liveplanner';
import { CATALOGUE as LIVEDOCUMENTS } from '@liveworkspace/settings/catalogues/livedocuments';
import { HELD_APP_SITES } from '@liveworkspace/sites';
import { panelModel } from './CatalogueSettingsView';
import { isSettingsAppId, loadAppCatalogue, panelAppIds, SETTINGS_APP_IDS } from './store';
import { fixtureCategories } from './test/fixture';

// An app registered before its launch (liveworkspace/docs/specs/010-site/site.md "Settings", "A held app"): its own
// catalogue and scope, shown in its own editor's panel alone.
describe('a held app in the Settings panel', () => {
  it('is in no list until launch', () => {
    for (const site of HELD_APP_SITES) {
      expect(SETTINGS_APP_IDS).not.toContain(site.id);
      expect(isSettingsAppId(site.id)).toBe(false);
    }
    expect(SETTINGS_APP_IDS).toEqual([
      'livediagram.app',
      'liveplanner.app',
      'livedocuments.app',
      'livedesign.app',
    ]);
    expect(panelAppIds(null)).toBe(SETTINGS_APP_IDS);
    expect(panelAppIds('liveplanner.app')).toBe(SETTINGS_APP_IDS);
  });

  it('shows in its own panel, first, with its own catalogue', async () => {
    expect(panelAppIds('livehuddle.app')).toEqual(['livehuddle.app', ...SETTINGS_APP_IDS]);
    expect(await loadAppCatalogue('livehuddle.app')).toBe(LIVEHUDDLE);
  });

  it('names its own group, keeping the common settings its editor has on its side', () => {
    const catalogues = { 'liveplanner.app': LIVEPLANNER, 'livedocuments.app': LIVEDOCUMENTS };
    const model = panelModel({
      mode: 'app',
      withShared: true,
      current: 'livehuddle.app',
      own: fixtureCategories(),
      catalogues,
      common: commonCatalogue(
        Object.entries(catalogues).map(([app, catalogue]) => ({ app, catalogue })),
      ),
      value: { all: {}, apps: {} },
      account: { tokensHref: '/explorer?settings=tokens' },
      renderLogo: () => null,
      saver: { changeApp: () => {}, changeShared: () => {} },
    });
    expect(model.groups?.map((group) => group.label)).toEqual(['Account', 'Common', 'livehuddle']);
    const keys = model.categories.flatMap((category) => category.rows.map((row) => row.key));
    // A common setting the editor has shows once, under Common; its own rows under its name.
    expect(keys.filter((key) => key.endsWith(':alignmentGuides'))).toEqual([
      'common:alignmentGuides',
    ]);
    expect(keys).toContain('common:showMinimap');
    expect(keys).toContain('livehuddle.app:autoAttach');
  });
});
