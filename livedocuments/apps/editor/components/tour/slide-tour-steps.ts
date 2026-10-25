// The Slides track of the Pages tour (docs/specs/007-editor/pages-tour.md "Slides track"): on the person's own
// slide, it opens the Layout and Background popovers to choose from, points at the +, then opens the Slide Deck and
// walks through it: the slide's row in it, a slide's menu, the show's settings and Present. Each control stays live,
// so a pick made while its step is up is kept. The deck stays open across its steps and closes after them.
import type { PageTourStep } from './page-tour-api';
import {
  addPageAnchor,
  closeTitlePopover,
  holdSlideDeck,
  openTitlePopover,
  pageButton,
  pageOrPopover,
  releaseSlideDeck,
  SLIDE_DECK,
  SLIDES_BUTTON,
} from './page-tour-dom';
import { opensFrom } from '@liveworkspace/workbench/components/tour/tour-open';

export function slideTourSteps(): PageTourStep[] {
  return [
    {
      id: 'layouts',
      title: 'Choose a Layout',
      body: 'Hover a layout to preview it. Press it to use it.',
      selector: (api) => pageOrPopover(api.pageId, 'Layout'),
      requires: (api) => pageButton(api.pageId, 'Layout'),
      prepare: (api) => openTitlePopover(api.pageId, 'Layout'),
      cleanup: (api) => closeTitlePopover(api.pageId, 'Layout'),
    },
    {
      id: 'background',
      title: 'Change the Background',
      body: 'Colours, gradients, pictures or animated backgrounds. Hover to preview, press to keep.',
      selector: (api) => pageOrPopover(api.pageId, 'Background'),
      requires: (api) => pageButton(api.pageId, 'Background'),
      prepare: (api) => openTitlePopover(api.pageId, 'Background'),
      cleanup: (api) => closeTitlePopover(api.pageId, 'Background'),
    },
    {
      id: 'add-page',
      title: 'Add Another Slide',
      body: '+ adds the next slide.',
      selector: addPageAnchor,
    },
    {
      id: 'deck',
      title: 'Your Slide Deck',
      body: 'Every slide is in your deck already, in order. Drag a row to move it; press one to go to that slide.',
      selector: () => `${SLIDE_DECK} [data-slide-slot]`,
      requires: () => SLIDES_BUTTON,
      prepare: holdSlideDeck,
      cleanup: releaseSlideDeck,
    },
    opensFrom(
      {
        id: 'slide-menu',
        title: 'Each Slide’s Menu',
        body: 'Speaker notes, hide a slide from the show, rename it or duplicate it.',
        selector: () => `${SLIDE_DECK} [data-slide-slot]`,
        requires: () => SLIDES_BUTTON,
        prepare: holdSlideDeck,
        cleanup: releaseSlideDeck,
      },
      () => `${SLIDE_DECK} button[aria-label^="Options for"]`,
    ),
    opensFrom(
      {
        id: 'show-settings',
        title: 'Set Up the Show',
        body: 'Transitions, their speed, auto-advance and slide size, set before you present.',
        selector: () => '[data-slide-deck-settings-trigger]',
        requires: () => SLIDES_BUTTON,
        prepare: holdSlideDeck,
        cleanup: releaseSlideDeck,
      },
      () => '[data-slide-deck-settings-trigger]',
    ),
    {
      id: 'present',
      title: 'Present',
      body: 'Present runs the deck full screen. Arrow keys move through it; Escape ends it.',
      selector: () => `${SLIDE_DECK} [data-presentation-start="panel"]`,
      requires: () => SLIDES_BUTTON,
      prepare: holdSlideDeck,
      cleanup: releaseSlideDeck,
    },
    {
      id: 'outro',
      card: 'outro',
      title: "You're ready to present",
      body: 'Make your next slide. Present when you are ready.',
    },
  ];
}
