// The Slides track of the Pages tour (docs/specs/007-editor/pages-tour.md "Slides track"): on the person's own
// slide, it opens the Layout, Background and speaker notes popovers, points at the + and opens the Slide Deck, where
// the deck is presented. Each control stays live, so a pick made while its step is up is kept.
import type { PageTourStep } from './page-tour-api';
import {
  ADD_PAGE_PRESS,
  addPageAnchor,
  BACKGROUND_CHOICES,
  closeNotes,
  closeSlideDeck,
  closeTitlePopover,
  layoutAnchor,
  layoutTiles,
  notesAnchor,
  notesButton,
  openLayouts,
  openNotes,
  openSlideDeck,
  openTitlePopover,
  pageButton,
  pageOrPopover,
  SLIDE_DECK,
  SLIDES_BUTTON,
} from './page-tour-dom';

export const SLIDE_WELCOME: PageTourStep = {
  id: 'welcome',
  card: 'welcome',
  title: 'New to slides?',
  body: 'A quick look at layouts, backgrounds, speaker notes and presenting, on your own slide. Try anything as you go.',
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
      // Every slide of a deck is in it already, so this teaches what the slide's deck place gives: its notes.
      id: 'notes',
      title: 'Write Your Speaker Notes',
      body: 'What you will say over this slide. Only you see them, in the presenter view.',
      selector: (api) => notesAnchor(api.pageId),
      requires: (api) => notesButton(api.pageId),
      prepare: (api) => openNotes(api.pageId),
      cleanup: (api) => closeNotes(api.pageId),
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
