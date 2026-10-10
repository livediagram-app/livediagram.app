// The steps of the Facilitate tour (docs/specs/012-collaboration/facilitate-tour.md "The steps"): a welcome
// card, then the session kit (the palette strip) → the Collaborate categories (the category picker, open) →
// the Session strip → Share → the mode switch, then the outro. It places nothing, so its steps only point at
// the chrome and open the one menu they explain.

import { closeDropdown, ensurePaletteOpen } from './tour-steps';
import { clickTour, findTour } from './tour-dom';
import { stepTelemetryType, type TourStepOf } from './tour-step';

// Nothing to drive beyond the DOM: the tour makes no content (spec "Tour content").
export type FacilitateTourApi = Record<string, never>;

export type FacilitateTourStep = TourStepOf<FacilitateTourApi>;

export const FACILITATE_TOUR_STEPS: FacilitateTourStep[] = [
  {
    id: 'welcome',
    card: 'welcome',
    title: 'Welcome to Facilitate',
    body: 'Facilitate is for running a session with your team: a retro, a workshop or a town hall. Want a quick look at where everything is?',
  },
  {
    id: 'kit',
    title: 'Your session kit',
    body: 'Popular holds what a session is run with: sticky notes, the timer, vote and poll buttons, a reveal zone, an agenda, an idea box and more.',
    target: 'palette',
    prepare: () => ensurePaletteOpen(),
  },
  {
    id: 'collaborate',
    title: 'Collaborate',
    body: 'Under Collaborate, Ask, Tools, Record, React, Selection Mode and Navigate hold every element that comes alive with the room.',
    target: 'palette-category-menu',
    alsoHighlight: 'palette-category',
    prepare: async () => {
      await ensurePaletteOpen();
      if (!findTour('palette-category-menu')) clickTour('palette-category');
    },
    cleanup: () => closeDropdown('palette-category-menu', 'palette-category'),
  },
  {
    id: 'session-strip',
    title: 'Run the room',
    body: 'Timer, Vote and Poll run for everyone on the tab, without placing anything on the canvas.',
    target: 'session-tools',
  },
  {
    id: 'share',
    title: 'Bring people in',
    body: 'Share a Participant link and people can add notes, vote and answer without changing the rest of the board.',
    target: 'share',
  },
  {
    id: 'modes',
    title: 'Switch modes',
    body: 'The mode belongs to the tab, so everyone on it follows. Diagram is a click away when the session is done.',
    target: 'editor-mode',
  },
  {
    id: 'outro',
    card: 'outro',
    title: "You're ready to facilitate",
    body: 'Everything a session needs is in the palette and the bottom-right corner. The help centre has more on each tool.',
  },
];

// The steps this surface has chrome for, filtered up front so the count stays honest (spec "The steps"):
// the Share button is not on every surface (a phone header, someone who may not share).
export function facilitateTourSteps({ canShare }: { canShare: boolean }): FacilitateTourStep[] {
  return FACILITATE_TOUR_STEPS.filter((step) => canShare || step.id !== 'share');
}

// Telemetry `type` token for a step-viewed event: 'session-strip' → 'FacilitateTourStepSessionStrip'.
export function facilitateTourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('FacilitateTourStep', stepId);
}
