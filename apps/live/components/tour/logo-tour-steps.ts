// The steps of Show Me on a logo page (docs/specs/007-editor/logo-pages.md "Show Me"), and the Pages tour's Logo
// track (docs/specs/007-editor/pages-tour.md "Logo track"): a tour of the logo tools, run on the page itself.
// Each step rings a real control of the page it was started on, which stays usable, so the person can pick a layout
// or turn the guides on while the step is up.
import type { PageTourApi, PageTourStep } from './page-tour-api';
import { pageCog } from './page-tour-dom';

type LogoTourStep = PageTourStep;

export const LOGO_WELCOME: LogoTourStep = {
  id: 'welcome',
  card: 'welcome',
  title: 'Getting started with logos?',
  body: 'Want a quick look at designing a logo? We will open its layouts and show you the guides, mirror drawing and combining shapes.',
};

const titleButton = (name: string) => (api: PageTourApi) =>
  `[data-logo-title-bar="${api.pageId}"] button[aria-label="${name}"]`;

const LAYOUTS: LogoTourStep = {
  id: 'layouts',
  title: 'Start From a Logo Layout',
  body: 'Lockups, wordmarks, emblems and marks, each a whole logo in your theme and font, ready to make your own. Pick one now if you like.',
  selector: () => '[data-page-panel]',
  requires: (api) => pageCog(api.pageId),
  prepare: (api) => api.openPanel(api.pageId, 'layouts'),
  cleanup: (api) => api.closePanel(),
};

const GUIDES: LogoTourStep = {
  id: 'guides',
  title: 'Draw on Guides',
  body: 'Centre lines, diagonals, circles, a square and a grid over the artboard, and shapes snap to the circle and square. Choose which show, and how strongly.',
  selector: titleButton('Guides'),
};

const MIRROR: LogoTourStep = {
  id: 'mirror',
  title: 'Mirror As You Draw',
  body: 'Turn it on and whatever you draw on one side appears on the other, or round the centre in radial copies.',
  selector: titleButton('Mirror'),
};

const COMBINE_SHOWING: LogoTourStep = {
  id: 'combine',
  title: 'Combine Shapes',
  body: 'Unite the selected shapes into one, subtract one from another, keep only where they overlap, or keep where they do not. Holes stay see-through.',
  selector: () => '[aria-label="Combine shapes"]',
};

// No two shapes are selected, so Combine is not showing: the step says how to find it.
const COMBINE_HIDDEN: LogoTourStep = {
  id: 'combine',
  title: 'Combine Shapes',
  body: 'Select two or more shapes on the page and Combine appears above them: unite them into one, subtract one from another, keep only where they overlap, or keep where they do not.',
};

const OUTRO: LogoTourStep = {
  id: 'outro',
  card: 'outro',
  title: 'That Is a Logo Page',
  body: 'When it is ready, Export › Logo Kit downloads it as SVG, PNGs from 16 to 1024 px and a favicon, in one zip.',
};

// The steps: Combine rings its button when two shapes are already selected, else it explains where it appears.
export function logoTourSteps(combineShowing: boolean): LogoTourStep[] {
  return [LAYOUTS, GUIDES, MIRROR, combineShowing ? COMBINE_SHOWING : COMBINE_HIDDEN, OUTRO];
}
