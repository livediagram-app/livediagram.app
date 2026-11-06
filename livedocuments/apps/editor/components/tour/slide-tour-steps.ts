// The Slides track of the Pages tour (docs/specs/007-editor/pages-tour.md "Slides track"): on the person's own
// slide, it opens the Layout and Background popovers to choose from, points at the +, then at the slide's row in
// Contents (the show's order), opens that row's menu (its place in the show) and points at Present. Each control
// stays live, so a pick made while its step is up is kept.
import type { PageTourApi, PageTourStep } from './page-tour-api';
import {
  addPageAnchor,
  closeTitlePopover,
  contentsRow,
  contentsRowMenu,
  HEADER_PRESENT,
  openTitlePopover,
  pageButton,
  pageOrPopover,
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
      title: 'Add Slide',
      body: '+ adds the next slide.',
      selector: addPageAnchor,
    },
    {
      id: 'contents',
      title: 'Your Slides',
      body: 'Every slide is in the show already, in this order. Drag a slide to move it; press one to go to it.',
      selector: (api) => contentsRow(api.pageId),
    },
    opensFrom(
      {
        id: 'slide-menu',
        title: 'Each Slide’s Menu',
        body: 'Hide a slide from the show without deleting it, or present from it.',
        selector: (api) => contentsRow(api.pageId),
      },
      (api: PageTourApi) => contentsRowMenu(api.pageId),
    ),
    {
      id: 'present',
      title: 'Present',
      body: 'Present runs the show full screen. Arrow keys move through it; Escape ends it. Transitions are in Settings, under Presenting.',
      selector: () => HEADER_PRESENT,
    },
    {
      id: 'outro',
      card: 'outro',
      title: "You're ready to present",
      body: 'Make your next slide. Present when you are ready.',
    },
  ];
}
