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
import { lucideGlyph, EDITOR_MODE_ICONS } from '@livedocuments/ui';
import { lucideLayers, lucideMap, lucidePalette } from '@livedocuments/icons/lucide';
import { CollaborateGlyph } from '@/components/panels/collaborate/CollaborateGlyph';
import { SlideDeckIcon } from '@/components/palette/palette-icons';

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
  | 'pages'
  | 'presenting'
  | 'layers'
  | 'map'
  | 'collaborate'
  | 'quickStyle'
  | 'notifications'
  | 'tokens';

// Every category, top-level and sub-category alike: each opens its own pane.
export type SettingsCategoryId = SettingsIconId | SettingsSubcategoryId;

// Each top-level category's tile. liveworkspace.app's "Your apps" dialog shows the same tiles, from
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
// button's glyph), at 16px. The Map and Quick Style
// have no toolbar button, so they take Lucide's map and palette from the
// same family. Pages is the mark Pages mode carries, so the row reads as
// that mode's settings. Notifications and API
// Tokens keep the shared bell and key.
const LayersSubGlyph = lucideGlyph(lucideLayers, 16);
const MapSubGlyph = lucideGlyph(lucideMap, 16);
const QuickStyleSubGlyph = lucideGlyph(lucidePalette, 16);
const PagesSubGlyph = EDITOR_MODE_ICONS.pages;
const SUBCATEGORY_GLYPHS: Record<SettingsSubcategoryId, () => ReactNode> = {
  pages: () => <PagesSubGlyph size={16} />,
  presenting: () => <SlideDeckIcon />,
  layers: () => <LayersSubGlyph />,
  map: () => <MapSubGlyph />,
  collaborate: () => <CollaborateGlyph size={16} />,
  quickStyle: () => <QuickStyleSubGlyph />,
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
