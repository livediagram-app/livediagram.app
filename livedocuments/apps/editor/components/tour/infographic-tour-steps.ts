// The Infographic track of the Pages tour (docs/specs/007-editor/pages-tour.md "Infographic track"): on the
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
      body: 'Hover a layout to preview it on your page. Press it to use it.',
      selector: (api) => pageOrPopover(api.pageId, 'Layout'),
      requires: (api) => pageButton(api.pageId, 'Layout'),
      prepare: (api) => openTitlePopover(api.pageId, 'Layout'),
      cleanup: (api) => closeTitlePopover(api.pageId, 'Layout'),
    },
    {
      id: 'background',
      title: 'Change the Background',
      body: 'Colours, gradients or pictures. Hover to preview, press to keep.',
      selector: (api) => pageOrPopover(api.pageId, 'Background'),
      requires: (api) => pageButton(api.pageId, 'Background'),
      prepare: (api) => openTitlePopover(api.pageId, 'Background'),
      cleanup: (api) => closeTitlePopover(api.pageId, 'Background'),
    },
    {
      id: 'page-size',
      title: 'Page Size',
      body: 'The cog sets the page size and orientation, and duplicates or deletes the page.',
      selector: () => '[data-page-panel]',
      requires: (api) => pageCog(api.pageId),
      prepare: (api) => api.openPanel(api.pageId, 'page'),
      cleanup: (api) => api.closePanel(),
    },
    {
      id: 'add-page',
      title: 'Add a Page',
      body: '+ adds another page like this one. Every page of a tab is one kind.',
      selector: addPageAnchor,
    },
    {
      id: 'present',
      title: 'Present It',
      body: 'Add any page as a slide, then Present shows them full screen.',
      selector: () => SLIDE_DECK,
      requires: () => SLIDES_BUTTON,
      prepare: openSlideDeck,
      cleanup: closeSlideDeck,
    },
    {
      id: 'outro',
      card: 'outro',
      title: "You're ready to make pages",
      body: 'Pick a layout and make it yours.',
    },
  ];
}
