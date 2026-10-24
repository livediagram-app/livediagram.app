// Icons of the tab bar, the tab / folder context menus and the chrome controls
// (docs/specs/004-interface-design/iconography.md). Menu glyphs render at the menu size step.

import { LockIcon, lucideGlyph, SearchIcon } from '@liveplanner/ui';
import {
  lucideBrushCleaning,
  lucideEyeOff,
  lucideFileInput,
  lucideFolder,
  lucideScale,
} from '@liveworkspace/icons/lucide';

import { MENU_ICON_PX } from '@/components/palette/context-menu-icons';

// A locked tab (the pill badge; the menu toolbar sizes its own buttons).
export function TabLockIcon() {
  return <LockIcon size={12} />;
}

// A tab that isn't shared with this visitor (docs/specs/013-workspace/tab-scoped-share-links.md).
// Deliberately not the padlock, which marks a tab its editors have locked.
export const TabNotSharedIcon = lucideGlyph(lucideEyeOff, 12);

export const FolderMenuIcon = lucideGlyph(lucideFolder, MENU_ICON_PX);
// Add the tab to another project.
export const MoveIcon = lucideGlyph(lucideFileInput, MENU_ICON_PX);
// Clear the tab's contents.
export const ClearIcon = lucideGlyph(lucideBrushCleaning, MENU_ICON_PX);

// Magnifier - the global-search button on the right edge of the bar, at the bar's 14px.
export function SearchGlyph() {
  return <SearchIcon size={14} />;
}

// Third-party licences (docs/specs/002-project-scope/third-party-licences.md): the
// scales of the law, a row of the Explorer's ⋯ menu.
export const ScaleIcon = lucideGlyph(lucideScale, MENU_ICON_PX);

export { SettingsIcon } from '@liveplanner/ui';
