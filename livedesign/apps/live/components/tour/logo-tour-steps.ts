// The steps of Show Me on a logo page (docs/specs/007-editor/logo-pages.md "Show Me"), and the Pages tour's Logo
// track (docs/specs/007-editor/pages-tour.md "Logo track"): a tour of the logo tools, run on the page itself.
// Each step rings a real control of the page it was started on, which stays usable, so the person can pick a layout
// or turn the guides on while the step is up.
import type { PageTourApi, PageTourStep } from './page-tour-api';
import { pageCog, pageSheet } from './page-tour-dom';
import { opensFrom } from './tour-open';
import { combineDemoShape, placeCombineDemo, uniteCombineDemo } from './logo-combine-demo';
import { elementSelector } from '@/lib/canvas-selectors';

type LogoTourStep = PageTourStep;

export const LOGO_WELCOME: LogoTourStep = {
  id: 'welcome',
  card: 'welcome',
  title: 'Getting started with Logos?',
  body: 'A quick look at logo layouts, guides, mirror drawing and combining shapes?',
};

const titleButton = (name: string) => (api: PageTourApi) =>
  `[data-logo-title-bar="${api.pageId}"] button[aria-label="${name}"]`;

const LAYOUTS: LogoTourStep = {
  id: 'layouts',
  title: 'Start From a Logo Layout',
  body: 'Start from a ready-made logo in your theme. Pick one now if you like.',
  selector: () => '[data-page-panel]',
  requires: (api) => pageCog(api.pageId),
  prepare: (api) => api.openPanel(api.pageId, 'layouts'),
  cleanup: (api) => api.closePanel(),
};

const GUIDES: LogoTourStep = opensFrom(
  {
    id: 'guides',
    title: 'Draw on Guides',
    body: 'Guides to line things up. Shapes snap to them. Choose which show.',
    selector: titleButton('Guides'),
  },
  titleButton('Guides'),
);

const MIRROR: LogoTourStep = opensFrom(
  {
    id: 'mirror',
    title: 'Mirror As You Draw',
    body: 'Draw on one side and it mirrors on the other, or round the centre.',
    selector: titleButton('Mirror'),
  },
  titleButton('Mirror'),
);

// Combine, shown on two shapes the tour places on the page (logo-combine-demo.ts): selected, so Combine appears; its
// menu opened; then united into one, as Unite does. The shapes and what they become go when the tour ends.
const COMBINE_BUTTON = '[aria-label="Combine shapes"]';

const COMBINE_SELECT: LogoTourStep = {
  id: 'combine',
  title: 'Combine Shapes',
  body: 'Select two or more shapes and Combine appears. Here are two, selected for you.',
  selector: () => COMBINE_BUTTON,
  // The Combine steps make what they point at: they need only the page on screen (spec "Filtering").
  requires: (api) => pageSheet(api.pageId),
  prepare: async (api) => {
    await placeCombineDemo(api.pageId);
  },
};

const COMBINE_MENU: LogoTourStep = opensFrom<PageTourApi, LogoTourStep>(
  {
    id: 'combine-menu',
    title: 'Four Ways to Combine',
    body: 'Unite merges them, Subtract cuts one from the other, Intersect keeps the overlap, Exclude keeps the rest.',
    selector: () => COMBINE_BUTTON,
    requires: (api) => pageSheet(api.pageId),
  },
  () => COMBINE_BUTTON,
);

const COMBINE_UNITE: LogoTourStep = {
  id: 'combine-unite',
  title: 'One Shape',
  body: 'United: the two are now one shape you can fill, outline and resize as one. Ours goes when the tour ends.',
  requires: (api) => pageSheet(api.pageId),
  selector: () => {
    const id = combineDemoShape();
    return id ? elementSelector(id) : null;
  },
  prepare: async () => {
    await uniteCombineDemo();
  },
};

const OUTRO: LogoTourStep = {
  id: 'outro',
  card: 'outro',
  title: 'That Is a Logo Page',
  body: 'Export › Logo Kit downloads every size you need, plus a favicon.',
};

// The steps, Combine shown on the tour's own shapes, which go when the tour ends (PagesTourHost).
export function logoTourSteps(): LogoTourStep[] {
  return [LAYOUTS, GUIDES, MIRROR, COMBINE_SELECT, COMBINE_MENU, COMBINE_UNITE, OUTRO];
}
