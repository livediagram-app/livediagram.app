// The Slides track of the Pages tour (docs/specs/007-editor/pages-tour.md "Slides track"): on the person's own
// slide, it opens the Layout and Background popovers to choose from, points at the deck button, the + and the Slide
// Deck, where the deck is presented. Each control stays live, so a pick made while its step is up is kept.
import type { PageTourStep } from './page-tour-api';
import {
  ADD_PAGE_PRESS,
  addPageAnchor,
  BACKGROUND_CHOICES,
  closeSlideDeck,
  closeTitlePopover,
  layoutAnchor,
  layoutTiles,
  openLayouts,
  openSlideDeck,
  openTitlePopover,
  pageButton,
  pageOrPopover,
  pageSheet,
  SLIDE_DECK,
  SLIDES_BUTTON,
} from './page-tour-dom';

export const SLIDE_WELCOME: PageTourStep = {
  id: 'welcome',
  card: 'welcome',
  title: 'New to slides?',
  body: 'A quick look at layouts, backgrounds, the deck and presenting, on your own slide. Try anything as you go.',
};

export function slideTourSteps(): PageTourStep[] {
  return [
    {
      id: 'layouts',
      title: 'Choose a Layout',
      body: 'Hover a layout to preview it. Press it to use it.',
      selector: (api) => layoutAnchor(api.pageId),
      requires: (api) => pageButton(api.pageId, 'Layout'),
      prepare: (api) => openLayouts(api.pageId),
      cleanup: (api) => closeTitlePopover(api.pageId, 'Layout'),
      tryIt: { label: 'Pick any layout', pressed: (api) => layoutTiles(api.pageId) },
    },
    {
      id: 'background',
      title: 'Change the Background',
      body: 'Colours, gradients, pictures or animated backgrounds. Hover to preview, press to keep.',
      selector: (api) => pageOrPopover(api.pageId, 'Background'),
      requires: (api) => pageButton(api.pageId, 'Background'),
      prepare: (api) => openTitlePopover(api.pageId, 'Background'),
      cleanup: (api) => closeTitlePopover(api.pageId, 'Background'),
      tryIt: { label: 'Pick a background', pressed: () => BACKGROUND_CHOICES },
    },
    {
      id: 'deck',
      title: 'Add It to the Deck',
      body: 'Add to Slides puts it in your deck. Notes holds what you want to say.',
      selector: (api) => `${pageSheet(api.pageId)} [data-page-deck-button]`,
    },
    {
      id: 'add-page',
      title: 'Add Another Slide',
      body: '+ adds the next slide.',
      selector: addPageAnchor,
      tryIt: { label: 'Press +', pressed: () => ADD_PAGE_PRESS },
    },
    {
      id: 'present',
      title: 'Present',
      body: 'Drag slides into order, then Present. Arrow keys move through them.',
      selector: () => SLIDE_DECK,
      requires: () => SLIDES_BUTTON,
      prepare: openSlideDeck,
      cleanup: closeSlideDeck,
    },
    {
      id: 'outro',
      card: 'outro',
      title: "You're ready to present",
      body: 'Make your next slide. Present when you are ready.',
    },
  ];
}
