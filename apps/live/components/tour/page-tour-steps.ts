// A page kind's track (docs/specs/007-editor/illustrate-tour.md "The steps"): its steps as Show Me runs them, or behind
// its welcome card as the Illustrate tour offers them. Loaded at the offer or the press (`import('./page-tour-steps')`),
// so the copy stays out of the editor's first load.
import type { PageKind } from '@livediagram/document';
import { ARTICLE_WELCOME, articleTourSteps } from './article-tour-steps';
import { INFOGRAPHIC_WELCOME, infographicTourSteps } from './infographic-tour-steps';
import { LOGO_WELCOME, logoTourSteps } from './logo-tour-steps';
import type { PageTourApi, PageTourNow, PageTourStep } from './page-tour-api';
import { SLIDE_WELCOME, slideTourSteps } from './slide-tour-steps';
import { stepTelemetryType } from './tour-step';

// The DOM tidy-up a page's tour needs, loaded with its steps so neither sits in the editor's first load.
export { resetPageTour, tidyPageTour } from './page-tour-dom';

/** A kind's steps, fixed from what is showing now. */
export function pageTourSteps(kind: PageKind, now: PageTourNow): PageTourStep[] {
  switch (kind) {
    case 'slide':
      return slideTourSteps();
    case 'article':
      return articleTourSteps();
    case 'logo':
      return logoTourSteps(now.combineShowing);
    default:
      return infographicTourSteps();
  }
}

const WELCOMES: Record<PageKind, PageTourStep> = {
  slide: SLIDE_WELCOME,
  infographic: INFOGRAPHIC_WELCOME,
  article: ARTICLE_WELCOME,
  logo: LOGO_WELCOME,
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
  now: PageTourNow,
  api: PageTourApi,
  exists: (selector: string) => boolean,
): PageTourStep[] {
  return pageTourSteps(kind, now).filter((step) => stepShown(step, api, exists));
}

/** The offered track: its welcome card, then its steps whose controls are on screen. */
export function illustrateTourSteps(
  kind: PageKind,
  now: PageTourNow,
  api: PageTourApi,
  exists: (selector: string) => boolean,
): PageTourStep[] {
  return [WELCOMES[kind], ...shownPageTourSteps(kind, now, api, exists)];
}

/** The telemetry `type` of a step view: ('slide', 'add-page') → 'IllustrateTourStepSlideAddPage'. */
export function illustrateTourStepTelemetryType(kind: PageKind, stepId: string): string {
  return stepTelemetryType('IllustrateTourStep', `${kind}-${stepId}`);
}
