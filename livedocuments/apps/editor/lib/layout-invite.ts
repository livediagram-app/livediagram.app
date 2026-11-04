// When an empty page shows its Use a Layout invite (docs/specs/007-editor/pages-mode.md "An empty page offers a
// layout, quietly"). Pure, so each rule is tested on its own.
import { pageKindOf, type LaidOutPage } from '@livedocuments/document';

// The least room on screen (the page's width and height at this zoom) the invite is shown in.
export const LAYOUT_INVITE_MIN_WIDTH = 240;
export const LAYOUT_INVITE_MIN_HEIGHT = 160;

export type LayoutInviteContext = {
  // The session may edit the tab (an Editor), and the page shows its title bar (not zen).
  editable: boolean;
  // A palette tool is armed (tap to drop or drag to draw): the page is where it lands.
  placing: boolean;
  // Nothing is on the page.
  empty: boolean;
  // The first page still offers its kind (FirstPageChoice).
  choosing: boolean;
  // A layout is previewed on the page (a hovered tile).
  previewing: boolean;
  // The page's Layouts popover is open: the gallery is already in hand.
  layoutsOpen: boolean;
  zoom: number;
};

/** Whether the page shows the invite: an Editor's empty, unlocked infographic or slide page, with room on screen,
 *  while nothing else is happening on it. */
export function layoutInviteShows(page: LaidOutPage, c: LayoutInviteContext): boolean {
  if (!c.editable || c.placing || !c.empty || c.choosing || c.previewing || c.layoutsOpen)
    return false;
  if (page.locked === true || page.flow) return false;
  const kind = pageKindOf(page);
  if (kind !== 'slide' && kind !== 'infographic') return false;
  return (
    page.rect.width * c.zoom >= LAYOUT_INVITE_MIN_WIDTH &&
    page.rect.height * c.zoom >= LAYOUT_INVITE_MIN_HEIGHT
  );
}
