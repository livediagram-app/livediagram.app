// A page kind's track (docs/specs/007-editor/pages-tour.md "The steps"): its steps as Show Me runs them, or behind
// its welcome card as the Pages tour offers them. Loaded at the offer or the press (`import('./page-tour-steps')`),
// so the copy stays out of the editor's first load.
import type { PageKind } from '@livediagram/document';
import { ARTICLE_WELCOME, articleTourSteps } from './article-tour-steps';
import { INFOGRAPHIC_WELCOME, infographicTourSteps } from './infographic-tour-steps';
import { LOGO_WELCOME, logoTourSteps } from './logo-tour-steps';
import type { PageTourApi, PageTourStep } from './page-tour-api';
import { SLIDE_WELCOME, slideTourSteps } from './slide-tour-steps';
import { stepTelemetryType } from './tour-step';

// The DOM tidy-up a page's tour needs, loaded with its steps so neither sits in the editor's first load.
export { resetPageTour, tidyPageTour } from './page-tour-dom';

/** A kind's steps. */
export function pageTourSteps(kind: PageKind): PageTourStep[] {
  switch (kind) {
    case 'slide':
      return slideTourSteps();
    case 'article':
      return articleTourSteps();
    case 'logo':
      return logoTourSteps();
    default:
      return infographicTourSteps();
  }
}

const WELCOMES: Record<PageKind, PageTourStep> = {
  slide: SLIDE_WELCOME,
  infographic: INFOGRAPHIC_WELCOME,
  article: ARTICLE_WELCOME,
  logo: LOGO_WELCOME,
  // A wireframe page is laid out as an infographic page is, and takes its track under its own welcome.
  wireframe: {
    ...INFOGRAPHIC_WELCOME,
    title: 'Getting started with wireframes?',
    body: 'A quick look at screen layouts, backgrounds and presenting?',
  },
};

/** Whether a step's control is on screen as the tour starts (spec "Filtering"): what it needs to open, else its own
 *  anchor. An anchorless card always is. `exists` says whether a selector is on screen. */
export function stepShown(
  step: PageTourStep,
  api: PageTourApi,
  exists: (selector: string) => boolean,
): boolean {
  if (step.requires) return exists(step.requires(api));
  if (step.selector) {
    const selector = step.selector(api);
    return selector !== null && exists(selector);
  }
  return step.target ? exists(`[data-tour-id="${step.target}"]`) : true;
}

/** A kind's steps whose controls are on screen: what Show Me runs. */
export function shownPageTourSteps(
  kind: PageKind,
  api: PageTourApi,
  exists: (selector: string) => boolean,
): PageTourStep[] {
  return pageTourSteps(kind).filter((step) => stepShown(step, api, exists));
}

/** The offered track: its welcome card, then its steps whose controls are on screen. */
export function pagesTourSteps(
  kind: PageKind,
  api: PageTourApi,
  exists: (selector: string) => boolean,
): PageTourStep[] {
  return [WELCOMES[kind], ...shownPageTourSteps(kind, api, exists)];
}

/** The telemetry `type` of a step view: ('slide', 'add-page') → 'PagesTourStepSlideAddPage'. */
export function pagesTourStepTelemetryType(kind: PageKind, stepId: string): string {
  return stepTelemetryType('PagesTourStep', `${kind}-${stepId}`);
}
