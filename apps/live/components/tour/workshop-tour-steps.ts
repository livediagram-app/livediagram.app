// The steps of the Workshop tour (docs/specs/012-collaboration/workshop-tour.md "The steps"): a welcome card, then Ask
// and Session on the category bar, then the session's key elements shown on the canvas (a Timer, a Dot Vote and a
// Poll, placed by the tour and taken away when it ends), the Session strip and Share, then the outro.

import { ensurePaletteOpen } from './tour-steps';
import { stepTelemetryType, type TourStepOf } from './tour-step';
import { opensFrom } from './tour-open';
import { elementSelector } from '@/lib/canvas-selectors';

// The session elements the tour shows (spec "Tour content"): placed once, in a row in view, with no history, and taken
// away when the tour ends, however it ends (WorkshopTourHost).
export type WorkshopDemo = 'timer' | 'vote' | 'poll';
export type WorkshopTourApi = {
  placeDemo: () => void;
  demoId: (which: WorkshopDemo) => string | null;
};

// A step on one of the placed elements.
function demoStep(id: WorkshopDemo, title: string, body: string): WorkshopTourStep {
  return {
    id,
    title,
    body,
    prepare: (api) => api.placeDemo(),
    selector: (api) => {
      const el = api.demoId(id);
      return el ? elementSelector(el) : null;
    },
  };
}

export type WorkshopTourStep = TourStepOf<WorkshopTourApi>;

export const WORKSHOP_TOUR_STEPS: WorkshopTourStep[] = [
  {
    id: 'welcome',
    card: 'welcome',
    title: 'Getting started with Workshop?',
    body: 'Run a retro, workshop or town hall with your team. A quick look at where everything is?',
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
  demoStep(
    'timer',
    'A Timer for the Room',
    'Drop a Timer on the canvas and it counts down for everyone, with pause, reset and more time on it. Here is one.',
  ),
  demoStep(
    'vote',
    'Dot Voting',
    'Press a Vote and everyone gets dots to put on the notes they back; the counts show when it ends.',
  ),
  demoStep(
    'poll',
    'A Live Poll',
    'A Poll asks the room a question. Answers come in live, and it can be yes or no, choices, a rating or open.',
  ),
  {
    id: 'session-strip',
    title: 'Run the Room',
    body: 'Timer, Vote and Poll run for everyone at once.',
    target: 'session-tools',
  },
  opensFrom(
    {
      id: 'share',
      title: 'Bring People In',
      body: 'A Participant link lets people add notes and vote, without changing the rest.',
      target: 'share',
    },
    () => '[data-tour-id="share"]',
    { modal: true },
  ),
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
