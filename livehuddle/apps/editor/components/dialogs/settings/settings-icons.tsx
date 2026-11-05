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
import { lucideGlyph } from '@livehuddle/ui';
import { lucideLayers, lucideMap } from '@liveworkspace/icons/lucide';
import { CollaborateGlyph } from '@liveworkspace/workbench/components/panels/collaborate/CollaborateGlyph';

// The categories that carry a tile: every top-level one. A sub-category
// (one per panel under Panels, one per mode under Editor, Notifications and
// API Tokens under Account) draws none of its own.
export type SettingsIconId =
  | 'account'
  | 'documents'
  | 'editor'
  | 'appearance'
  | 'keyboard'
  | 'panels'
  | 'accessibility'
  | 'tours'
  | 'privacy';

// The sub-categories, nested under a top-level category (Editor, Panels, Account).
export type SettingsSubcategoryId =
  'layers' | 'map' | 'collaborate' | 'notifications' | 'tokens' | 'webhooks';

// Every category, top-level and sub-category alike: each opens its own pane.
export type SettingsCategoryId = SettingsIconId | SettingsSubcategoryId;

// Each top-level category's tile. liveworkspace.app's Settings panel shows the same tiles, from
// the derived catalogue (settings-site-catalogue.test.ts).
export const SETTINGS_TILES: Record<SettingsIconId, SettingsTileId> = {
  account: 'account',
  documents: 'folder',
  editor: 'editor',
  appearance: 'appearance',
  keyboard: 'keyboard',
  panels: 'panels',
  accessibility: 'accessibility',
  tours: 'tours',
  privacy: 'privacy',
};

// A sub-category's glyph: the same mark its panel carries in the editor, so
// the row is recognisable as that panel's settings. Layers and Collaborate
// are the toolbar's own (Lucide layers, as LayersStackIcon; the Collaborate
// button's glyph), at 16px. The Map has no toolbar button, so it takes
// Lucide's map from the same family. Notifications and API Tokens keep the shared bell and key.
const LayersSubGlyph = lucideGlyph(lucideLayers, 16);
const MapSubGlyph = lucideGlyph(lucideMap, 16);
const SUBCATEGORY_GLYPHS: Record<SettingsSubcategoryId, () => ReactNode> = {
  layers: () => <LayersSubGlyph />,
  map: () => <MapSubGlyph />,
  collaborate: () => <CollaborateGlyph size={16} />,
  notifications: () => <SettingsSharedGlyph id="notifications" />,
  tokens: () => <SettingsSharedGlyph id="tokens" />,
  webhooks: () => <SettingsSharedGlyph id="webhooks" />,
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
