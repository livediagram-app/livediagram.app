// When an empty page offers its layouts on itself (docs/specs/007-editor/pages-mode.md "An empty
// page offers its layouts"): the Start From a Layout card (EmptyPageLayouts) where the page on
// screen has room for it, else a Choose a Layout button in its middle (EmptyPageInvite). Pure, so
// each rule is tested on its own.
import type { LaidOutPage } from '@livedocuments/document';

// Screen px an empty page needs round the in-page layout card.
export const LAYOUT_CARD_MARGIN = 16;
// The least room on screen the card is shown in (its header, the search and chips, a row of tiles).
export const LAYOUT_CARD_MIN_WIDTH = 340;
export const LAYOUT_CARD_MIN_HEIGHT = 380;
// The most the card grows to, however large the page is on screen.
export const LAYOUT_CARD_MAX_WIDTH = 900;
export const LAYOUT_CARD_MAX_HEIGHT = 660;

export type LayoutCardContext = {
  // The session may edit this page's tab.
  editable: boolean;
  // A palette tile is armed (tap to drop or drag to draw): the page is where it will land.
  placing: boolean;
  // How many elements are on the page.
  contentCount: number;
  // The first page still offers its kind.
  offersKind: boolean;
  // The page's own panel is open.
  panelOpen: boolean;
  // Hidden with the card's Hide, until the tab is next opened.
  hidden: boolean;
  zoom: number;
};

/** Whether the empty page offers its layouts on itself at all, whatever its size on screen. */
export function layoutOfferShows(page: LaidOutPage, c: LayoutCardContext): boolean {
  return (
    c.editable &&
    !c.placing &&
    page.locked !== true &&
    page.startedBlank !== true &&
    !page.flow &&
    page.kind !== 'article' &&
    // A wireframe page's screen stays clear: its layouts are the Layout button's alone.
    page.kind !== 'wireframe' &&
    c.contentCount === 0 &&
    !c.offersKind &&
    !c.panelOpen &&
    !c.hidden
  );
}

/** The card's size on screen for the page: the room the page leaves inside its margin, capped. */
export function layoutCardSize(page: LaidOutPage, zoom: number): { width: number; height: number } {
  return {
    width: Math.min(LAYOUT_CARD_MAX_WIDTH, page.rect.width * zoom - LAYOUT_CARD_MARGIN * 2),
    height: Math.min(LAYOUT_CARD_MAX_HEIGHT, page.rect.height * zoom - LAYOUT_CARD_MARGIN * 2),
  };
}

/** The card shows where the page offers its layouts and has room on screen for it. */
export function layoutCardShows(page: LaidOutPage, c: LayoutCardContext): boolean {
  if (!layoutOfferShows(page, c)) return false;
  const { width, height } = layoutCardSize(page, c.zoom);
  return width >= LAYOUT_CARD_MIN_WIDTH && height >= LAYOUT_CARD_MIN_HEIGHT;
}

/** The Choose a Layout button shows where the page offers its layouts but the card has no room. */
export function layoutInviteShows(page: LaidOutPage, c: LayoutCardContext): boolean {
  return layoutOfferShows(page, c) && !layoutCardShows(page, c);
}
