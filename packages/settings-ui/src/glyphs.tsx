'use client';

import type { ReactNode } from 'react';
import { useSettingsUiKit } from './kit';

// The navigation chevron: points the way a tap will take you. `forward` for a row that pushes a
// screen, `back` for the control that returns from one.
export function NavChevron({
  direction = 'forward',
  className,
}: {
  direction?: 'forward' | 'back';
  className?: string;
}) {
  const { Glyph } = useSettingsUiKit();
  return (
    <Glyph size={14} units={12} className={`shrink-0${className ? ` ${className}` : ''}`}>
      <path d={direction === 'forward' ? 'M4.5 2.5 8 6l-3.5 3.5' : 'M7.5 2.5 4 6l3.5 3.5'} />
    </Glyph>
  );
}

// The disclosure chevron of an accordion: down when closed, up when open.
export function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  const { Glyph } = useSettingsUiKit();
  return (
    <Glyph
      size={12}
      units={12}
      className={`transition-transform duration-micro ${open ? 'rotate-180' : ''}${
        className ? ` ${className}` : ''
      }`}
    >
      <path d="M2 4l4 4 4-4" />
    </Glyph>
  );
}

export function InfoGlyph() {
  const { Glyph } = useSettingsUiKit();
  return (
    <Glyph size={12} units={12} className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-400">
      <circle cx="6" cy="6" r="5" />
      <path d="M6 5.4v3M6 3.6h.01" />
    </Glyph>
  );
}

// The category tiles, drawn iOS-style: a white line-art mark on a filled, rounded colour tile. The
// tile colour is what the eye navigates by once the labels blur together, so each kind of category
// owns a distinct hue (distinct desaturated too, and every tile has its own glyph, so colour is never
// the only channel). Every app's Settings has the same top-level kinds, so they live here once and
// an app maps its category ids onto them (its settings-icons.tsx).
export type SettingsTileId =
  | 'account'
  | 'folder'
  | 'editor'
  | 'appearance'
  | 'keyboard'
  | 'panels'
  | 'accessibility'
  | 'tours'
  | 'privacy';

const TILE: Record<SettingsTileId, string> = {
  account: 'bg-teal-600',
  folder: 'bg-lime-700',
  editor: 'bg-blue-500',
  appearance: 'bg-sky-600',
  keyboard: 'bg-orange-500',
  panels: 'bg-amber-500',
  accessibility: 'bg-indigo-500',
  tours: 'bg-pink-600',
  privacy: 'bg-emerald-600',
};

function Svg({ children }: { children: ReactNode }) {
  const { Glyph } = useSettingsUiKit();
  return (
    <Glyph size={16} units={20}>
      {children}
    </Glyph>
  );
}

const TILE_GLYPHS: Record<SettingsTileId, ReactNode> = {
  // A person.
  account: (
    <Svg>
      <circle cx="10" cy="7" r="3.2" />
      <path d="M4 16.5a6 6 0 0 1 12 0" />
    </Svg>
  ),
  // A folder, where new files go.
  folder: (
    <Svg>
      <path d="M3 6.5a1.5 1.5 0 0 1 1.5-1.5h3.2l1.6 1.8h6.2A1.5 1.5 0 0 1 17 8.3v6.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5Z" />
    </Svg>
  ),
  // A frame with a docked side panel, the editor chrome.
  editor: (
    <Svg>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <path d="M12 3.5v13" />
    </Svg>
  ),
  // A half-filled circle, the standard light/dark mark.
  appearance: (
    <Svg>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 3a7 7 0 0 1 0 14Z" fill="currentColor" stroke="none" />
    </Svg>
  ),
  // A keyboard, keys over a space bar.
  keyboard: (
    <Svg>
      <rect x="2" y="5" width="16" height="10.5" rx="2" />
      <path d="M5.5 8.5h.01M8.5 8.5h.01M11.5 8.5h.01M14.5 8.5h.01M7 12.2h6" />
    </Svg>
  ),
  // Stacked sheets, for the floating panels these settings dress.
  panels: (
    <Svg>
      <rect x="2.5" y="6.5" width="11" height="11" rx="2" />
      <path d="M6.5 6.5v-3a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3" />
    </Svg>
  ),
  // The standard accessibility figure.
  accessibility: (
    <Svg>
      <circle cx="10" cy="4" r="1.6" />
      <path d="M4.5 7.5c3.5 1.2 7.5 1.2 11 0" />
      <path d="M10 7.8v4.2" />
      <path d="m10 12 -2.6 5.2" />
      <path d="m10 12 2.6 5.2" />
    </Svg>
  ),
  // A compass, for being shown around.
  tours: (
    <Svg>
      <circle cx="10" cy="10" r="7" />
      <path d="m12.8 7.2-1.6 4-4 1.6 1.6-4Z" />
    </Svg>
  ),
  // A padlock.
  privacy: (
    <Svg>
      <rect x="4" y="8.5" width="12" height="9" rx="2" />
      <path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" />
    </Svg>
  ),
};

/** One tile: the coloured rounded square with its glyph centred. */
export function SettingsCategoryTile({ id }: { id: SettingsTileId }) {
  return (
    <span
      aria-hidden
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-white ${TILE[id]}`}
    >
      {TILE_GLYPHS[id]}
    </span>
  );
}

// The sub-category glyphs every app's Account shares: a bell for Notifications, a key for API Tokens.
export type SettingsSharedGlyphId = 'notifications' | 'tokens';

const SHARED_GLYPHS: Record<SettingsSharedGlyphId, ReactNode> = {
  notifications: (
    <Svg>
      <path d="M6 7.5a4 4 0 0 1 8 0c0 3 1.2 4.2 1.7 4.7a.5.5 0 0 1-.35.85H4.65a.5.5 0 0 1-.35-.85C4.8 11.7 6 10.5 6 7.5Z" />
      <path d="M8.5 15.5a1.8 1.8 0 0 0 3 0" />
    </Svg>
  ),
  tokens: (
    <Svg>
      <circle cx="7" cy="7" r="3.8" />
      <path d="M9.7 9.7 17 17M14.5 14.5l2-2M12.5 16.5l2-2" />
    </Svg>
  ),
};

/** A shared glyph on its own (the tokens row's key). */
export function SettingsSharedGlyph({ id }: { id: SettingsSharedGlyphId }) {
  return <>{SHARED_GLYPHS[id]}</>;
}

/** A sub-category's glyph: plain and untinted, not a tile, since the tile belongs to the top-level
 *  category above it. */
export function SettingsSubcategoryGlyph({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400"
    >
      {children}
    </span>
  );
}
