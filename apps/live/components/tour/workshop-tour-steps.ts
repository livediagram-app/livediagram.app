// The steps of the Workshop tour (docs/specs/012-collaboration/workshop-tour.md "The steps"): a welcome
// card, then Ask and Session on the category bar → the Session strip → Share, then the outro. The
// palette itself is the Diagram tour's. It places
// nothing, so its steps only point at the chrome and open the one menu they explain.

import { ensurePaletteOpen } from './tour-steps';
import { stepTelemetryType, type TourStepOf } from './tour-step';

// Nothing to drive beyond the DOM: the tour makes no content (spec "Tour content").
export type WorkshopTourApi = Record<string, never>;

export type WorkshopTourStep = TourStepOf<WorkshopTourApi>;

export const WORKSHOP_TOUR_STEPS: WorkshopTourStep[] = [
  {
    id: 'welcome',
    card: 'welcome',
    title: 'New to Workshop?',
    body: 'Run a retro, workshop or town hall with your team. A quick look at where everything is.',
  },
  {
    id: 'collaborate',
    title: 'Collaborate',
    body: 'Ask puts a question to the room. Session has timers, reveals, reactions and more.',
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
    body: 'Timer, Vote and Poll run for everyone at once.',
    target: 'session-tools',
  },
  {
    id: 'share',
    title: 'Bring people in',
    body: 'A Participant link lets people add notes and vote, without changing the rest.',
    target: 'share',
  },
  {
    id: 'outro',
    card: 'outro',
    title: "You're ready to run a workshop",
    body: 'Everything you need is in the palette and the bottom-right corner.',
  },
];

// The steps this surface has chrome for, filtered up front so the count stays honest (spec "The steps"):
// the Share button is not on every surface (a phone header, someone who may not share).
export function workshopTourSteps({ canShare }: { canShare: boolean }): WorkshopTourStep[] {
  return WORKSHOP_TOUR_STEPS.filter((step) => canShare || step.id !== 'share');
}

// Telemetry `type` token for a step-viewed event: 'session-strip' → 'WorkshopTourStepSessionStrip'.
export function workshopTourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('WorkshopTourStep', stepId);
}
