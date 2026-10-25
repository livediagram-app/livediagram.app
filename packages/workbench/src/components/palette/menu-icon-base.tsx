// The menu icons' size steps (docs/specs/004-interface-design/iconography.md, "Size steps") and the one
// menu glyph other icon modules re-export, apart from context-menu-icons (which re-exports them all).
// Kept to plain constants and a function so an icon module that only needs the step, in an editor
// with its own context-menu icons, does not pull in that module's top-level glyph builds.
import { LinkIcon } from '@liveworkspace/ui';

/** Size step of every menu row and section icon. */
export const MENU_ICON_PX = 14;
/** Size step of the icon-only quick-action buttons pinned to the top of a menu. */
export const QUICK_ACTION_ICON_PX = 16;

export function LinkMenuIcon() {
  return <LinkIcon size={MENU_ICON_PX} />;
}
