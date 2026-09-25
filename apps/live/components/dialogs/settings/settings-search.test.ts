import { describe, expect, it } from 'vitest';
import { SETTINGS_CATEGORIES, visibleCategories } from './settings-catalogue';
import { firstMatchingCategory, searchSettings } from './settings-search';

const ALL = visibleCategories(true, { emailEnabled: true, signedIn: true });

function keysFor(query: string): string[] {
  return searchSettings(ALL, query).categories.flatMap((c) => c.rows.map((r) => r.key));
}

describe('settings search', () => {
  it('does nothing until the query is worth filtering on', () => {
    // A one-character query matches almost everything, so filtering on it
    // would flash the whole list into "results" and teach nobody anything.
    for (const query of ['', '   ', 'a']) {
      const result = searchSettings(ALL, query);
      expect(result.searching, JSON.stringify(query)).toBe(false);
      expect(result.categories.flatMap((c) => c.rows)).toHaveLength(
        ALL.flatMap((c) => c.rows).length,
      );
    }
  });

  it('finds a setting by its label', () => {
    expect(keysFor('minimap')).toContain('showMinimap');
  });

  it('finds a setting by a synonym it never displays', () => {
    // The whole point of `keywords`: the reader types what they call it, not
    // what we called it.
    expect(keysFor('dark mode')).toContain('appearance');
    expect(keysFor('transparency')).toContain('panelOpacity');
    expect(keysFor('hotkeys')).toContain('shortcutsEnabled');
    expect(keysFor('analytics')).toContain('telemetryEnabled');
  });

  it('finds a setting by its category or section name', () => {
    // "layers" appears in no layer row's own label.
    const layerKeys = keysFor('layers');
    expect(layerKeys).toContain('layersShowPreview');
    expect(layerKeys).toContain('layersShowCount');
    expect(layerKeys).toContain('layerHoverPreview');
  });

  it('narrows on a second term rather than widening', () => {
    const one = keysFor('preview');
    const two = keysFor('preview revert');
    expect(two.length).toBeLessThan(one.length);
    expect(two).toContain('activityRevertHoverPreview');
  });

  it('is case-insensitive', () => {
    expect(keysFor('DARK MODE')).toEqual(keysFor('dark mode'));
  });

  it('counts matches per category for the badges', () => {
    const result = searchSettings(ALL, 'email');
    const notifications = result.categories.find((c) => c.id === 'notifications')!;
    expect(notifications.matchCount).toBe(notifications.rows.length);
    expect(notifications.matchCount).toBeGreaterThan(0);
    // Categories that do not match still appear, so the badge can say zero
    // and the rail keeps its shape while you type.
    expect(result.categories).toHaveLength(ALL.length);
    expect(result.totalMatches).toBe(result.categories.reduce((sum, c) => sum + c.matchCount, 0));
  });

  it('reports no matches for a query nothing answers', () => {
    const result = searchSettings(ALL, 'zzzznothing');
    expect(result.searching).toBe(true);
    expect(result.totalMatches).toBe(0);
  });

  it('moves the selection to a category that actually has hits', () => {
    const result = searchSettings(ALL, 'dark mode');
    // 'privacy' has no match for this query, so the desktop pane would sit
    // empty beside a rail full of badges.
    expect(firstMatchingCategory(result, 'privacy')).toBe('appearance');
    // ...but a selection that DOES match is left alone.
    expect(firstMatchingCategory(result, 'appearance')).toBe('appearance');
  });

  it('leaves the selection alone when not searching', () => {
    const result = searchSettings(ALL, '');
    expect(firstMatchingCategory(result, 'privacy')).toBe('privacy');
    expect(firstMatchingCategory(result, null)).toBeNull();
  });

  it('gives every row keywords, so none is findable only by its exact label', () => {
    for (const row of SETTINGS_CATEGORIES.flatMap((c) => c.rows)) {
      expect(row.keywords?.trim(), row.key).toBeTruthy();
      // Lowercase, like the help registry's, since matching lowercases the
      // query but not the haystack's source of truth.
      expect(row.keywords, row.key).toBe(row.keywords?.toLowerCase());
    }
  });
});
