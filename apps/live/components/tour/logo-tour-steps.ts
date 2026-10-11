// The steps of Show Me on a logo page (docs/specs/007-editor/logo-pages.md "Show Me"): a tour of the logo tools, run on
// the page itself. Each step rings a real control of the page it was started on, which stays usable, so the person
// can pick a layout or turn the guides on while the step is up.
import type { TourStepOf } from './tour-step';

export type LogoTourApi = {
  // The logo page the tour was started on.
  pageId: string;
  // Opens that page's panel on its Layouts tab, and closes it again.
  openLayouts: (pageId: string) => void;
  closePanel: () => void;
};

type LogoTourStep = TourStepOf<LogoTourApi>;

const titleButton = (name: string) => (api: LogoTourApi) =>
  `[data-logo-title-bar="${api.pageId}"] button[aria-label="${name}"]`;

const LAYOUTS: LogoTourStep = {
  id: 'layouts',
  title: 'Start From a Logo Layout',
  body: 'Lockups, wordmarks and emblems, each a whole logo in your theme and font, ready to make your own. Pick one now if you like.',
  selector: () => '[data-page-panel]',
  prepare: (api) => api.openLayouts(api.pageId),
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
