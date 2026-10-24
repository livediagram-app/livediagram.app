// The Settings list's icons. A top-level category carries one of the shared tiles
// (@liveworkspace/settings-ui: a white line-art mark on a filled, rounded colour tile, the same in
// every app); a sub-category carries a plain glyph, the mark its panel or mode has in this editor.

import type { ReactNode } from 'react';
import {
  SettingsCategoryTile,
  SettingsSharedGlyph,
  SettingsSubcategoryGlyph,
  type SettingsTileId,
} from '@liveworkspace/settings-ui';
import { CollaborateGlyph } from '@/components/panels/collaborate/CollaborateGlyph';

// The categories that carry a tile: every top-level one. A sub-category
// (Collaborate under Panels, Notifications and API Tokens under Account)
// draws none of its own.
export type SettingsIconId =
  | 'account'
  | 'projects'
  | 'editor'
  | 'appearance'
  | 'keyboard'
  | 'panels'
  | 'accessibility'
  | 'tours'
  | 'privacy';

// The sub-categories, nested under a top-level category (Panels, Account).
export type SettingsSubcategoryId = 'collaborate' | 'notifications' | 'tokens';

// Every category, top-level and sub-category alike: each opens its own pane.
export type SettingsCategoryId = SettingsIconId | SettingsSubcategoryId;

// Each top-level category's tile. liveworkspace.app's "Your apps" dialog shows the same tiles, from
// the derived catalogue (settings-site-catalogue.test.ts).
export const SETTINGS_TILES: Record<SettingsIconId, SettingsTileId> = {
  account: 'account',
  projects: 'folder',
  editor: 'editor',
  appearance: 'appearance',
  keyboard: 'keyboard',
  panels: 'panels',
  accessibility: 'accessibility',
  tours: 'tours',
  privacy: 'privacy',
};

// A sub-category's glyph: the same mark its panel carries in the editor, so
// the row is recognisable as that panel's settings. Collaborate is the
// Collaborate button's own glyph, at 16px. Notifications and API Tokens keep
// the shared bell and key.
const SUBCATEGORY_GLYPHS: Record<SettingsSubcategoryId, () => ReactNode> = {
  collaborate: () => <CollaborateGlyph size={16} />,
  notifications: () => <SettingsSharedGlyph id="notifications" />,
  tokens: () => <SettingsSharedGlyph id="tokens" />,
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
