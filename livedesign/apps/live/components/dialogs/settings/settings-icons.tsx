// The Settings list's icons. A top-level category carries one of the shared tiles
// (@liveworkspace/settings-ui: a white line-art mark on a filled, rounded colour tile, the same in
// every app); a sub-category under Account carries a plain glyph.

import type { ReactNode } from 'react';
import {
  SettingsCategoryTile,
  SettingsSharedGlyph,
  SettingsSubcategoryGlyph,
  type SettingsTileId,
} from '@liveworkspace/settings-ui';

// The categories that carry a tile: every top-level one. A sub-category (Notifications, API Tokens and the rest under
// Account) draws none of its own.
export type SettingsIconId =
  | 'account'
  | 'designs'
  | 'editor'
  | 'appearance'
  | 'keyboard'
  | 'panels'
  | 'accessibility'
  | 'tours'
  | 'privacy';

// The sub-categories, nested under Account (the Settings panel lists each on its own).
export type SettingsSubcategoryId = 'notifications' | 'tokens' | 'webhooks' | 'data';

// Every category, top-level and sub-category alike: each opens its own pane.
export type SettingsCategoryId = SettingsIconId | SettingsSubcategoryId;

// Each top-level category's tile. liveworkspace.app's Settings panel shows the same tiles, from
// the derived catalogue (settings-site-catalogue.test.ts).
export const SETTINGS_TILES: Record<SettingsIconId, SettingsTileId> = {
  account: 'account',
  designs: 'folder',
  editor: 'editor',
  appearance: 'appearance',
  keyboard: 'keyboard',
  panels: 'panels',
  accessibility: 'accessibility',
  tours: 'tours',
  privacy: 'privacy',
};

// A sub-category's glyph: the account's keep the shared bell, key, hook and tray. Panels and Editor have no
// sub-categories: each panel's and mode's settings are a section of their category.
const SUBCATEGORY_GLYPHS: Record<SettingsSubcategoryId, () => ReactNode> = {
  notifications: () => <SettingsSharedGlyph id="notifications" />,
  tokens: () => <SettingsSharedGlyph id="tokens" />,
  webhooks: () => <SettingsSharedGlyph id="webhooks" />,
  data: () => <SettingsSharedGlyph id="data" />,
};

/** A category's icon in the Settings list: its tile, or a sub-category's glyph. */
export function settingsCategoryIcon(id: SettingsCategoryId): ReactNode {
  if (id in SETTINGS_TILES)
    return <SettingsCategoryTile id={SETTINGS_TILES[id as SettingsIconId]} />;
  return (
    <SettingsSubcategoryGlyph>
      {SUBCATEGORY_GLYPHS[id as SettingsSubcategoryId]()}
    </SettingsSubcategoryGlyph>
  );
}
