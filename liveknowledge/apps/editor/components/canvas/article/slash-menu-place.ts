// Where the slash menu sits (docs/specs/030-knowledgebase/page-surface.md "The slash menu", "Where it sits"): under
// the `/`, its left edge at it, opening above instead where it would run past the window's foot, never past the
// window's sides; the preview beside the list only where the window has room for both. Pure: the view measures and
// asks.
import { clampIntoRange, POPOVER_VIEWPORT_MARGIN } from '@liveknowledge/ui';

/** The list's width and the preview's beside it (px). */
export const SLASH_LIST_WIDTH = 312;
export const SLASH_PREVIEW_WIDTH = 240;
/** The tallest the menu grows before its list scrolls (px). */
export const SLASH_MAX_HEIGHT = 380;
// The gap between the `/`'s line and the menu.
const GAP = 6;

/** The menu's box: its corner, whether it opens above the `/`, whether the preview shows, its width, and the tallest
 *  it may be there (its list scrolling past that). */
export type SlashPlace = {
  left: number;
  top: number;
  above: boolean;
  preview: boolean;
  width: number;
  maxHeight: number;
};

/** The menu's place for a `/` at `at` (its line's box, window px), `height` tall, in a window `win` big. `preview`:
 *  whether a preview may show at all (a desktop pointer). */
export function placeSlashMenu(
  at: { left: number; top: number; bottom: number },
  height: number,
  win: { width: number; height: number },
  preview: boolean,
): SlashPlace {
  const m = POPOVER_VIEWPORT_MARGIN;
  const both = SLASH_LIST_WIDTH + SLASH_PREVIEW_WIDTH;
  const withPreview = preview && win.width >= both + 2 * m;
  const width = Math.min(withPreview ? both : SLASH_LIST_WIDTH, win.width - 2 * m);
  const left = clampIntoRange(at.left, m, win.width - width - m);
  const h = Math.min(height, SLASH_MAX_HEIGHT);
  const below = at.bottom + GAP;
  const fitsBelow = below + h + m <= win.height;
  // Above only where there is more room there: else it stays below, its list scrolling in the room it has.
  const room = { below: win.height - below - m, above: at.top - GAP - m };
  const above = !fitsBelow && room.above > room.below;
  const maxHeight = Math.max(0, Math.min(SLASH_MAX_HEIGHT, above ? room.above : room.below));
  const top = above ? Math.max(m, at.top - GAP - Math.min(h, maxHeight)) : below;
  return { left, top, above, preview: withPreview, width, maxHeight };
}
