// When an empty page shows its in-page layout card (EmptyPageLayouts; docs/specs/007-editor/pages-mode.md "An empty
// infographic page shows its layouts inside itself"). Pure, so each rule is tested on its own.
import type { LaidOutPage } from '@livediagram/document';
import { EMPTY_PAGE_LAYOUTS_WIDTH } from './EmptyPageLayouts';

// Screen px an empty page needs round the in-page layout card, and the least height on screen that holds it.
export const LAYOUT_CARD_MARGIN = 16;
// Six categories make three rows of cards.
export const LAYOUT_CARD_MIN_HEIGHT = 440;

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

export function layoutCardShows(page: LaidOutPage, c: LayoutCardContext): boolean {
  return (
    c.editable &&
    !c.placing &&
    page.locked !== true &&
    page.startedBlank !== true &&
    !page.flow &&
    page.kind !== 'article' &&
    c.contentCount === 0 &&
    !c.offersKind &&
    !c.panelOpen &&
    !c.hidden &&
    page.rect.width * c.zoom >= EMPTY_PAGE_LAYOUTS_WIDTH + LAYOUT_CARD_MARGIN * 2 &&
    page.rect.height * c.zoom >= LAYOUT_CARD_MIN_HEIGHT
  );
}
