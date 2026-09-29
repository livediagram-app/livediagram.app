// Icons of the tab bar, the tab / folder context menus and the chrome controls
// (docs/specs/004-interface-design/iconography.md). Menu glyphs render at the menu size step.

import { Glyph, LockIcon, lucideGlyph, SearchIcon } from '@livediagram/ui';
import {
  lucideBrushCleaning,
  lucideEyeOff,
  lucideFileInput,
  lucideFolder,
  lucideScale,
  lucideSlidersHorizontal,
} from '@livediagram/icons/lucide';

import { MENU_ICON_PX } from '@/components/palette/context-menu-icons';

// A locked tab (the pill badge; the menu toolbar sizes its own buttons).
export function TabLockIcon() {
  return <LockIcon size={12} />;
}

// A tab that isn't shared with this visitor (docs/specs/013-workspace/tab-scoped-share-links.md).
// Deliberately not the padlock, which marks a tab its editors have locked.
export const TabNotSharedIcon = lucideGlyph(lucideEyeOff, 12);

export const FolderMenuIcon = lucideGlyph(lucideFolder, MENU_ICON_PX);
// Add the tab to another document.
export const MoveIcon = lucideGlyph(lucideFileInput, MENU_ICON_PX);
// Clear the tab's contents.
export const ClearIcon = lucideGlyph(lucideBrushCleaning, MENU_ICON_PX);

// Magnifier - the global-search button on the right edge of the bar, at the bar's 14px.
export function SearchGlyph() {
  return <SearchIcon size={14} />;
}

// GitHub mark - the open-source repo link in the footer (docs/specs/002-project-scope/open-source-and-business-model.md).
export function GithubIcon() {
  return (
    <Glyph size={16} units={16} filled>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </Glyph>
  );
}

// Third-party licences (docs/specs/002-project-scope/third-party-licences.md): the
// scales of the law, a row of the Explorer's ⋯ menu.
export const ScaleIcon = lucideGlyph(lucideScale, MENU_ICON_PX);

// Settings: two sliders, never a cog (a cog's spokes read as a sun, the appearance toggle).
export const SettingsIcon = lucideGlyph(lucideSlidersHorizontal, 16);
