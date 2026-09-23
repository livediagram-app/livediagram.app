import { describe, expect, it } from 'vitest';
import { SETTINGS_CATEGORIES } from '@/components/dialogs/settings/settings-catalogue';
import { SETTINGS_SEARCH_ITEMS } from './settings-search-items';
import { buildSearchResults } from './search';

const ALL_ROWS = SETTINGS_CATEGORIES.flatMap((c) => c.rows);

describe('SETTINGS_SEARCH_ITEMS', () => {
  it('offers every setting, exactly once', () => {
    // The point of building this from the catalogue: a setting cannot be
    // searchable-but-absent or present-but-unsearchable.
    expect(SETTINGS_SEARCH_ITEMS).toHaveLength(ALL_ROWS.length);
    expect(new Set(SETTINGS_SEARCH_ITEMS.map((i) => i.id)).size).toBe(ALL_ROWS.length);
  });

  it('resolves every result back to a real row, so no click dead-ends', () => {
    // A result carries a categoryId + rowKey that the dialog then looks up.
    // A stale pair opens Settings on nothing, which looks like the dialog is
    // broken rather than the search.
    for (const item of SETTINGS_SEARCH_ITEMS) {
      const category = SETTINGS_CATEGORIES.find((c) => c.id === item.categoryId);
      expect(category, item.id).toBeTruthy();
      expect(category!.label, item.id).toBe(item.categoryLabel);
      expect(
        category!.rows.map((r) => r.key),
        item.id,
      ).toContain(item.rowKey);
    }
  });

  it('carries the category and section into the haystack', () => {
    // So "layers" finds the layer rows from the canvas search too, not just
    // from inside the dialog.
    const thumbnails = SETTINGS_SEARCH_ITEMS.find((i) => i.rowKey === 'layersShowPreview')!;
    expect(thumbnails.keywords.toLowerCase()).toContain('panels');
    expect(thumbnails.keywords.toLowerCase()).toContain('layers');
  });

  it('surfaces a Settings group from the shared search builder', () => {
    const groups = buildSearchResults({
      query: 'dark mode',
      diagrams: [],
      folders: [],
      settingItems: SETTINGS_SEARCH_ITEMS,
    });
    const settings = groups.find((g) => g.key === 'settings');
    expect(settings).toBeTruthy();
    const theme = settings!.items.find((i) => i.kind === 'setting' && i.rowKey === 'appearance');
    expect(theme).toBeTruthy();
  });

  it('finds a setting by a synonym the UI never prints', () => {
    const groups = buildSearchResults({
      query: 'hotkeys',
      diagrams: [],
      folders: [],
      settingItems: SETTINGS_SEARCH_ITEMS,
    });
    const settings = groups.find((g) => g.key === 'settings');
    expect(
      settings?.items.some((i) => i.kind === 'setting' && i.rowKey === 'shortcutsEnabled'),
    ).toBe(true);
  });

  it('offers nothing when the caller passes no catalogue', () => {
    // Both surfaces that mount the Settings dialog pass it (the editor and
    // the Explorer). A caller that cannot open Settings must simply get no
    // Settings group rather than an empty heading.
    const groups = buildSearchResults({ query: 'dark mode', diagrams: [], folders: [] });
    expect(groups.find((g) => g.key === 'settings')).toBeUndefined();
  });
});
