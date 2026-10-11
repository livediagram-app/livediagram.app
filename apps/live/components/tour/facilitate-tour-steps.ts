// The steps of the Facilitate tour (docs/specs/012-collaboration/facilitate-tour.md "The steps"): a welcome
// card (or the welcome tour's closing card, which can start it), then the Collaborate band of the category
// picker → the Session strip → Share, then the outro. The palette itself is the welcome tour's. It places
// nothing, so its steps only point at the chrome and open the one menu they explain.

import { closeDropdown, ensurePaletteOpen } from './tour-steps';
import { clickTour, findTour, waitForTour } from './tour-dom';
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
    id: 'collaborate',
    title: 'Collaborate',
    body: 'The session kit lives under Collaborate: Ask, Tools, Record, React, Selection Mode and Navigate hold every element that comes alive with the room.',
    // The Collaborate band only, from its heading to its last category, inside the open picker.
    target: 'band-collaborate',
    alsoHighlight: 'option-collab-navigate',
    ringOverMenu: true,
    prepare: async () => {
      await ensurePaletteOpen();
      if (!findTour('palette-category-menu')) clickTour('palette-category');
      await waitForTour('band-collaborate');
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
    id: 'outro',
    card: 'outro',
    title: "You're ready to facilitate",
    body: 'Everything a session needs is in the palette and the bottom-right corner. The help centre has more on each tool.',
  },
];

// The steps this surface has chrome for, filtered up front so the count stays honest (spec "The steps"):
// the Share button is not on every surface (a phone header, someone who may not share).
// Started from the welcome tour's closing card, it has no welcome card of its own: that card just asked.
export function facilitateTourSteps({
  canShare,
  withWelcome = true,
}: {
  canShare: boolean;
  withWelcome?: boolean;
}): FacilitateTourStep[] {
  return FACILITATE_TOUR_STEPS.filter(
    (step) => (canShare || step.id !== 'share') && (withWelcome || step.card !== 'welcome'),
  );
}

// Telemetry `type` token for a step-viewed event: 'session-strip' → 'FacilitateTourStepSessionStrip'.
export function facilitateTourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('FacilitateTourStep', stepId);
}
