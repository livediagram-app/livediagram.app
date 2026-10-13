// The steps of the Illustrate tour (docs/specs/007-editor/illustrate-tour.md "The steps"): a welcome card, then a
// page's name and its cog, the add-a-page +, and the Slides button, then the outro. It places nothing, so its steps
// only point at the page chrome.

import { stepTelemetryType, type TourStepOf } from './tour-step';

// Nothing to drive beyond the DOM: the tour makes no content (spec "Tour content").
export type IllustrateTourApi = Record<string, never>;

export type IllustrateTourStep = TourStepOf<IllustrateTourApi>;

export const ILLUSTRATE_TOUR_STEPS: IllustrateTourStep[] = [
  {
    id: 'welcome',
    card: 'welcome',
    title: 'Getting started with Illustrate?',
    body: 'Want a quick tour of pages, layouts and slides so you can make something beautiful in minutes?',
  },
  {
    id: 'page-name',
    title: 'Your Pages',
    body: "Each page's name sits above it: press it to fit that page to the screen, or drag it to put the pages in another order.",
    target: 'page-name',
  },
  {
    id: 'page-settings',
    title: 'Page Settings',
    body: "The cog opens this page's settings, such as its size. Beside it, Layout starts the page from a ready-made design, Tidy Up straightens it and Background paints it.",
    target: 'page-cog',
  },
  {
    id: 'add-page',
    title: 'Add a Page',
    body: 'Add another page after the last: an infographic, an article, a slide or a logo.',
    target: 'add-page',
  },
  {
    id: 'slides',
    title: 'Slides',
    body: 'Build a slide deck from your pages and present it, one page at a time.',
    target: 'slides',
  },
  {
    id: 'outro',
    card: 'outro',
    title: "You're ready to illustrate",
    body: 'Pick a page and start making. The help centre has more on pages, layouts and slides.',
  },
];

// The steps this surface has chrome for, filtered up front so the count stays honest (spec "The steps"): a page
// too small on screen hides its name and cog, a document without room for another page shows no +, and the Slides
// button is not on every surface. `shown` says whether an anchor is on screen when the tour starts.
export function illustrateTourSteps(shown: (tourId: string) => boolean): IllustrateTourStep[] {
  return ILLUSTRATE_TOUR_STEPS.filter((step) => !step.target || shown(step.target));
}

// Telemetry `type` token for a step-viewed event: 'page-settings' → 'IllustrateTourStepPageSettings'.
export function illustrateTourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('IllustrateTourStep', stepId);
}
