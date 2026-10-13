// The Slides track of the Illustrate tour (docs/specs/007-editor/illustrate-tour.md "Slides track"): on the person's own
// slide, it opens the Layout and Background popovers to choose from, points at the deck button, the + and the Slide
// Deck, where the deck is presented. Each control stays live, so a pick made while its step is up is kept.
import type { PageTourStep } from './page-tour-api';
import {
  closeSlideDeck,
  closeTitlePopover,
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
  title: 'Getting started with slides?',
  body: 'Want a quick look at making a slide? We will open its layouts and backgrounds, add it to the deck and show you where to present. Try anything as we go.',
};

export function slideTourSteps(): PageTourStep[] {
  return [
    {
      id: 'layouts',
      title: 'Choose a Layout',
      body: 'Hover a layout to see it on your slide, then press one to place it. Change Theme, at the top, restyles every page at once.',
      selector: (api) => pageOrPopover(api.pageId, 'Layout'),
      requires: (api) => pageButton(api.pageId, 'Layout'),
      prepare: (api) => openTitlePopover(api.pageId, 'Layout'),
      cleanup: (api) => closeTitlePopover(api.pageId, 'Layout'),
    },
    {
      id: 'background',
      title: 'Change the Background',
      body: 'Colours, gradients, animated backgrounds and pictures, with a pattern on top if you like. Hover one to preview it, press to keep it.',
      selector: (api) => pageOrPopover(api.pageId, 'Background'),
      requires: (api) => pageButton(api.pageId, 'Background'),
      prepare: (api) => openTitlePopover(api.pageId, 'Background'),
      cleanup: (api) => closeTitlePopover(api.pageId, 'Background'),
    },
    {
      id: 'deck',
      title: 'Add It to the Deck',
      body: 'Add to Slides puts this slide in the deck. Once it is in, the eye hides it from the presentation or shows it again, and Notes beside it holds what to say.',
      selector: (api) => `${pageSheet(api.pageId)} [data-page-deck-button]`,
    },
    {
      id: 'add-page',
      title: 'Add Another Slide',
      body: 'The + adds the next page. Slide comes first in its list, so Enter adds another slide straight away.',
      target: 'add-page',
    },
    {
      id: 'present',
      title: 'Present',
      body: 'Your deck: drag the slides into order, then press Present to show them full screen, one at a time. Arrow keys move through them.',
      selector: () => SLIDE_DECK,
      requires: () => SLIDES_BUTTON,
      prepare: openSlideDeck,
      cleanup: closeSlideDeck,
    },
    {
      id: 'outro',
      card: 'outro',
      title: "You're ready to present",
      body: 'Make the next slide, then press Present. The help centre has more on slide pages.',
    },
  ];
}
