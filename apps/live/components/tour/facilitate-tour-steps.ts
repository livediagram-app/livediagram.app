// The steps of the Facilitate tour (docs/specs/012-collaboration/facilitate-tour.md "The steps"): a welcome
// card, then Ask and Session on the category bar → the Session strip → Share, then the outro. The
// palette itself is the Diagram tour's. It places
// nothing, so its steps only point at the chrome and open the one menu they explain.

import { ensurePaletteOpen } from './tour-steps';
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
    body: 'The session kit sits at the end of the palette: Ask puts a question to the room, and Session holds the timers, reveals, records, reactions, selection modes and places to go.',
    // Ask and Session on the category bar (docs/specs/007-editor/toolbar-layout.md "The category bar").
    target: 'bar-collab-ask',
    alsoHighlight: 'bar-session',
    prepare: async () => {
      await ensurePaletteOpen();
    },
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
export function facilitateTourSteps({ canShare }: { canShare: boolean }): FacilitateTourStep[] {
  return FACILITATE_TOUR_STEPS.filter((step) => canShare || step.id !== 'share');
}

// Telemetry `type` token for a step-viewed event: 'session-strip' → 'FacilitateTourStepSessionStrip'.
export function facilitateTourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('FacilitateTourStep', stepId);
}
