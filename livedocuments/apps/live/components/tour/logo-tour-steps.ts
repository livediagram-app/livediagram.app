// The steps of Show Me on a logo page (docs/specs/007-editor/logo-pages.md "Show Me"), and the Pages tour's Logo
// track (docs/specs/007-editor/pages-tour.md "Logo track"): a tour of the logo tools, run on the page itself.
// Each step rings a real control of the page it was started on, which stays usable, so the person can pick a layout
// or turn the guides on while the step is up.
import type { PageTourApi, PageTourStep } from './page-tour-api';
import { pageCog } from './page-tour-dom';
import { opensFrom } from './tour-open';

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

const OUTRO: LogoTourStep = {
  id: 'outro',
  card: 'outro',
  title: 'That Is a Logo Page',
  body: 'Export › Logo Kit downloads every size you need, plus a favicon.',
};

// The steps.
export function logoTourSteps(): LogoTourStep[] {
  return [LAYOUTS, GUIDES, MIRROR, OUTRO];
}
