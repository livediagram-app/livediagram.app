// The Infographic track of the Illustrate tour (docs/specs/007-editor/illustrate-tour.md "Infographic track"): on the
// person's own page, its name, the Layout and Background popovers opened to choose from, its size in the panel, the +
// and the Slide Deck. Each control stays live, so a pick made while its step is up is kept.
import type { PageTourStep } from './page-tour-api';
import {
  addPageAnchor,
  closeSlideDeck,
  closeTitlePopover,
  openSlideDeck,
  openTitlePopover,
  pageButton,
  pageCog,
  pageOrPopover,
  pageSheet,
  SLIDE_DECK,
  SLIDES_BUTTON,
} from './page-tour-dom';

export const INFOGRAPHIC_WELCOME: PageTourStep = {
  id: 'welcome',
  card: 'welcome',
  title: 'Getting started with infographics?',
  body: 'Want a quick look at laying out a page? We will open its layouts, backgrounds and size, and show you how to add pages and present them.',
};

export function infographicTourSteps(): PageTourStep[] {
  return [
    {
      id: 'page-name',
      title: 'Your Page',
      body: "The page's name sits above it: press it to fit the page to the screen, or drag it to put your pages in another order.",
      selector: (api) => `${pageSheet(api.pageId)} [data-tour-id="page-name"]`,
    },
    {
      id: 'layouts',
      title: 'Start From a Layout',
      body: 'Posters, explainers, data, steps and more, each laid out in your theme. Hover one to see it on the page, then press it to place it.',
      selector: (api) => pageOrPopover(api.pageId, 'Layout'),
      requires: (api) => pageButton(api.pageId, 'Layout'),
      prepare: (api) => openTitlePopover(api.pageId, 'Layout'),
      cleanup: (api) => closeTitlePopover(api.pageId, 'Layout'),
    },
    {
      id: 'background',
      title: 'Change the Background',
      body: 'Colours, gradients and pictures, with a pattern on top if you like. Hover one to preview it, press to keep it.',
      selector: (api) => pageOrPopover(api.pageId, 'Background'),
      requires: (api) => pageButton(api.pageId, 'Background'),
      prepare: (api) => openTitlePopover(api.pageId, 'Background'),
      cleanup: (api) => closeTitlePopover(api.pageId, 'Background'),
    },
    {
      id: 'page-size',
      title: 'Page Size',
      body: 'The cog opens the page’s settings: A4, Letter, A3, square and social sizes, portrait or landscape. Duplicate, move or delete the page from the row below.',
      selector: () => '[data-page-panel]',
      requires: (api) => pageCog(api.pageId),
      prepare: (api) => api.openPanel(api.pageId, 'page'),
      cleanup: (api) => api.closePanel(),
    },
    {
      id: 'add-page',
      title: 'Add a Page',
      body: 'The + adds another page after the last: an infographic, an article, a slide or a logo.',
      selector: addPageAnchor,
    },
    {
      id: 'present',
      title: 'Present It',
      body: 'Any page can be a slide. Pick it here and press Add as slide, then Present shows your pages full screen, one at a time.',
      selector: () => SLIDE_DECK,
      requires: () => SLIDES_BUTTON,
      prepare: openSlideDeck,
      cleanup: closeSlideDeck,
    },
    {
      id: 'outro',
      card: 'outro',
      title: "You're ready to illustrate",
      body: 'Pick a layout and make it yours. The help centre has more on pages, layouts and slides.',
    },
  ];
}
