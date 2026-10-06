// The category glyphs for the Settings list, drawn iOS-style: a white
// line-art mark on a filled, rounded colour tile. The tile colour is the
// thing the eye actually navigates by once the labels blur together, so each
// category owns a distinct hue and keeps it in both the mobile root list and
// the desktop sidebar.
//
// Drawn here rather than pulled from @livediagram/icons because that package
// is the canvas catalogue (what a user places on the canvas); these are chrome,
// sized for a 28px tile and stroked to read at that size.

import type { ReactNode } from 'react';
import { Glyph, lucideGlyph, EDITOR_MODE_ICONS } from '@livediagram/ui';
import { lucideLayers, lucideMap, lucidePalette } from '@livediagram/icons/lucide';
import { CollaborateGlyph } from '@/components/panels/collaborate/CollaborateGlyph';

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
  | 'ai'
  | 'privacy';

// The sub-categories, nested under a top-level category (Editor, Panels, Account).
export type SettingsSubcategoryId =
  'draw' | 'layers' | 'map' | 'collaborate' | 'quickStyle' | 'notifications' | 'tokens';

// Every category, top-level and sub-category alike: each opens its own pane.
export type SettingsCategoryId = SettingsIconId | SettingsSubcategoryId;

// Tailwind classes rather than hexes so the tiles follow the same dark-mode
// pass as the rest of the chrome. Each hue is distinct at a glance AND when
// desaturated, so the list stays navigable for a colour-blind reader, the
// glyphs differ too, the colour is a second channel, never the only one.
const TILE: Record<SettingsIconId, string> = {
  account: 'bg-teal-600',
  documents: 'bg-lime-700',
  editor: 'bg-blue-500',
  appearance: 'bg-sky-600',
  keyboard: 'bg-orange-500',
  panels: 'bg-amber-500',
  accessibility: 'bg-indigo-500',
  ai: 'bg-violet-500',
  privacy: 'bg-emerald-600',
};

// One tile: the coloured rounded square with its glyph centred.
export function SettingsCategoryIcon({ id }: { id: SettingsIconId }) {
  return (
    <span
      aria-hidden
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-white ${TILE[id]}`}
    >
      {CATEGORY_GLYPHS[id]}
    </span>
  );
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <Glyph size={16} units={20}>
      {children}
    </Glyph>
  );
}

// Editor: the panel layout itself: a frame with a docked side panel, which
// is what the group's settings (panel layout, minimap) rearrange.
const EditorGlyph = (
  <Svg>
    <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
    <path d="M12 3.5v13" />
  </Svg>
);

// Keyboard: a keyboard, keys over a space bar. The shortcut list and its
// on/off switch are the whole group, so the device itself is the mark.
const KeyboardGlyph = (
  <Svg>
    <rect x="2" y="5" width="16" height="10.5" rx="2" />
    <path d="M5.5 8.5h.01M8.5 8.5h.01M11.5 8.5h.01M14.5 8.5h.01M7 12.2h6" />
  </Svg>
);

// Documents: a folder, where new documents go (docs/specs/013-workspace/default-folders.md).
const DocumentsGlyph = (
  <Svg>
    <path d="M3 6.5a1.5 1.5 0 0 1 1.5-1.5h3.2l1.6 1.8h6.2A1.5 1.5 0 0 1 17 8.3v6.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5Z" />
  </Svg>
);

// Account: a person.
const AccountGlyph = (
  <Svg>
    <circle cx="10" cy="7" r="3.2" />
    <path d="M4 16.5a6 6 0 0 1 12 0" />
  </Svg>
);

// Appearance: a half-filled circle, the standard light/dark mark.
const AppearanceGlyph = (
  <Svg>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 3a7 7 0 0 1 0 14Z" fill="currentColor" stroke="none" />
  </Svg>
);

// Panels: stacked sheets, for the floating panels these settings dress.
const PanelsGlyph = (
  <Svg>
    <rect x="2.5" y="6.5" width="11" height="11" rx="2" />
    <path d="M6.5 6.5v-3a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3" />
  </Svg>
);

// Notifications: a bell.
const NotificationsGlyph = (
  <Svg>
    <path d="M6 7.5a4 4 0 0 1 8 0c0 3 1.2 4.2 1.7 4.7a.5.5 0 0 1-.35.85H4.65a.5.5 0 0 1-.35-.85C4.8 11.7 6 10.5 6 7.5Z" />
    <path d="M8.5 15.5a1.8 1.8 0 0 0 3 0" />
  </Svg>
);

// Accessibility: the standard accessibility figure, the one mark a reader
// already knows means this group.
const AccessibilityGlyph = (
  <Svg>
    <circle cx="10" cy="4" r="1.6" />
    <path d="M4.5 7.5c3.5 1.2 7.5 1.2 11 0" />
    <path d="M10 7.8v4.2" />
    <path d="m10 12 -2.6 5.2" />
    <path d="m10 12 2.6 5.2" />
  </Svg>
);

// AI: a spark.
const AiGlyph = (
  <Svg>
    <path d="M8.75 2.5c.6 3.4 1.6 4.4 5 5-3.4.6-4.4 1.6-5 5-.6-3.4-1.6-4.4-5-5 3.4-.6 4.4-1.6 5-5Z" />
    <path d="M14.25 13.5c.25 1.4.65 1.8 2 2-1.35.25-1.75.65-2 2-.25-1.35-.65-1.75-2-2 1.35-.2 1.75-.6 2-2Z" />
  </Svg>
);

// API Tokens: a key, the mark the tokens have always carried.
export const TokensGlyph = (
  <Svg>
    <circle cx="7" cy="7" r="3.8" />
    <path d="M9.7 9.7 17 17M14.5 14.5l2-2M12.5 16.5l2-2" />
  </Svg>
);

// Privacy: a padlock.
const PrivacyGlyph = (
  <Svg>
    <rect x="4" y="8.5" width="12" height="9" rx="2" />
    <path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" />
  </Svg>
);

export const CATEGORY_GLYPHS: Record<SettingsIconId, ReactNode> = {
  account: AccountGlyph,
  documents: DocumentsGlyph,
  editor: EditorGlyph,
  appearance: AppearanceGlyph,
  keyboard: KeyboardGlyph,
  panels: PanelsGlyph,
  accessibility: AccessibilityGlyph,
  ai: AiGlyph,
  privacy: PrivacyGlyph,
};

// A sub-category's glyph: the same mark its panel carries in the editor, so
// the row is recognisable as that panel's settings. Layers and Collaborate
// are the toolbar's own (Lucide layers, as LayersStackIcon; the Collaborate
// button's glyph), at 16px. The Map and Quick Style
// have no toolbar button, so they take Lucide's map and palette from the
// same family. Draw is the marker the editor mode switch shows for Draw
// mode, so the row reads as that mode's settings. Notifications and API
// Tokens keep the bell and key they carried as top-level tiles. Plain and untinted, not a tile: the tile belongs to
// the top-level category above, and a second column of tiles would read as
// more top-level categories.
const LayersSubGlyph = lucideGlyph(lucideLayers, 16);
const MapSubGlyph = lucideGlyph(lucideMap, 16);
const QuickStyleSubGlyph = lucideGlyph(lucidePalette, 16);
const DrawSubGlyph = EDITOR_MODE_ICONS.draw;
const SUBCATEGORY_GLYPHS: Record<SettingsSubcategoryId, () => ReactNode> = {
  draw: () => <DrawSubGlyph size={16} />,
  layers: () => <LayersSubGlyph />,
  map: () => <MapSubGlyph />,
  collaborate: () => <CollaborateGlyph size={16} />,
  quickStyle: () => <QuickStyleSubGlyph />,
  notifications: () => NotificationsGlyph,
  tokens: () => TokensGlyph,
};

export function SettingsSubcategoryIcon({ id }: { id: SettingsSubcategoryId }) {
  return (
    <span
      aria-hidden
      className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400"
    >
      {SUBCATEGORY_GLYPHS[id]()}
    </span>
  );
}
