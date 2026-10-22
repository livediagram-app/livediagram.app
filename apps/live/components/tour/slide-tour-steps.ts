// The Slides track of the Pages tour (docs/specs/007-editor/pages-tour.md "Slides track"): on the person's own
// slide, it opens the Layout and Background popovers to choose from, then points at the +. Each control stays live,
// so a pick made while its step is up is kept.
import type { PageTourStep } from './page-tour-api';
import {
  addPageAnchor,
  closeTitlePopover,
  openTitlePopover,
  pageButton,
  pageOrPopover,
} from './page-tour-dom';

export const SLIDE_WELCOME: PageTourStep = {
  id: 'welcome',
  card: 'welcome',
  title: 'Getting started with Slides?',
  body: 'A quick look at slide layouts and backgrounds? Try anything as we go.',
};

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
      id: 'outro',
      card: 'outro',
      title: "You're ready to make slides",
      body: 'Make your next slide.',
    },
  ];
}
