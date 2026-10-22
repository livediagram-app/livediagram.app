// A page kind's track (docs/specs/007-editor/pages-tour.md "The steps"): its steps as Show Me runs them, or behind
// its welcome card as the Pages tour offers them. Loaded at the offer or the press (`import('./page-tour-steps')`),
// so the copy stays out of the editor's first load.
import type { PageKind } from '@livedesign/document';
import { LOGO_WELCOME, logoTourSteps } from './logo-tour-steps';
import { WIREFRAME_WELCOME, wireframeTourSteps } from './wireframe-tour-steps';
import { PHOTO_WELCOME, photoTourSteps } from './photo-tour-steps';
import type { PageTourApi, PageTourStep } from './page-tour-api';
import { stepTelemetryType } from './tour-step';

// The DOM tidy-up a page's tour needs, loaded with its steps so neither sits in the editor's first load.
export { resetPageTour, tidyPageTour } from './page-tour-dom';

/** A kind's steps. */
export function pageTourSteps(kind: PageKind): PageTourStep[] {
  if (kind === 'photo') return photoTourSteps();
  return kind === 'logo' ? logoTourSteps() : wireframeTourSteps();
}

const WELCOMES: Record<PageKind, PageTourStep> = {
  logo: LOGO_WELCOME,
  wireframe: WIREFRAME_WELCOME,
  photo: PHOTO_WELCOME,
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

/** The telemetry `type` of a step view: ('logo', 'add-page') → 'PagesTourStepLogoAddPage'. */
export function pagesTourStepTelemetryType(kind: PageKind, stepId: string): string {
  return stepTelemetryType('PagesTourStep', `${kind}-${stepId}`);
}
