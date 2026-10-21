import type { UserPreferences } from './user-preferences';

// Whether Explorer Home opens on its banner, the hero (docs/specs/013-workspace/explorer-home.md "Hiding the banner").
// One reading for the shell (the hero and the header's search field) and the pane (Home's page header), so the page
// never shows two search fields, nor none.
export function homeBannerShown(prefs: Pick<UserPreferences, 'homeBanner'>): boolean {
  return prefs.homeBanner !== false;
}
