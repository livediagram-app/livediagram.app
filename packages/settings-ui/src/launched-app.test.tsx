import { describe, expect, it } from 'vitest';
import { commonCatalogue } from '@liveworkspace/settings/common';
import { CATALOGUE as LIVEHUDDLE } from '@liveworkspace/settings/catalogues/livehuddle';
import { CATALOGUE as LIVEPLANNER } from '@liveworkspace/settings/catalogues/liveplanner';
import { CATALOGUE as LIVEDOCUMENTS } from '@liveworkspace/settings/catalogues/livedocuments';
import { HELD_APP_SITES } from '@liveworkspace/sites';
import { panelModel } from './CatalogueSettingsView';
import {
  isSettingsAppId,
  loadAppCatalogue,
  panelAppIds,
  SETTINGS_APP_IDS,
  type SettingsAppId,
} from './store';
import { fixtureCategories } from './test/fixture';

// livehuddle, launched (liveworkspace/docs/specs/010-site/site.md "Settings"): its row in APP_SITES lists it in every
// panel, as any app. A held app (none today) would show only in its own editor's panel, first.
describe('a launched app in the Settings panel', () => {
  it('is in every list', () => {
    expect(HELD_APP_SITES).toEqual([]);
    expect(SETTINGS_APP_IDS).toEqual([
      'livediagram.app',
      'liveplanner.app',
      'livedocuments.app',
      'livedesign.app',
      'livehuddle.app',
    ]);
    expect(isSettingsAppId('livehuddle.app')).toBe(true);
    expect(panelAppIds(null)).toBe(SETTINGS_APP_IDS);
    expect(panelAppIds('livehuddle.app')).toBe(SETTINGS_APP_IDS);
    expect(panelAppIds('liveplanner.app')).toBe(SETTINGS_APP_IDS);
  });

  it('would put a held app first in its own panel alone', () => {
    const held = 'livenext.app' as SettingsAppId;
    expect(isSettingsAppId(held)).toBe(false);
    expect(panelAppIds(held)).toEqual([held, ...SETTINGS_APP_IDS]);
  });

  it('loads its own catalogue', async () => {
    expect(await loadAppCatalogue('livehuddle.app')).toBe(LIVEHUDDLE);
  });

  it('names its own group in its own panel, keeping the common settings its editor has on its side', () => {
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
