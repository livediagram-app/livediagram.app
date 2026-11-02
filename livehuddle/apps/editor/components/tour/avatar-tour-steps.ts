// The steps of the Avatar tour (docs/specs/008-canvas/avatar-tour.md "The steps"): the Avatar button, the character sheet, Behaviour and Reactions, speaking, pushing, then the outro. It changes nothing: it
// opens the Avatar panel to show it, and closes it again for the push step and on the way out.

import {
  clickTour,
  findTour,
  waitForTour,
} from '@liveworkspace/workbench/components/tour/tour-dom';
import {
  stepTelemetryType,
  type TourStepOf,
} from '@liveworkspace/workbench/components/tour/tour-step';

// Whether the panel was open when the tour began, so leaving puts it back as it found it: open again if the person
// had it open (the push step closes it), closed if the tour opened it.
// Null outside a tour.
let panelOpenAtStart: boolean | null = null;

// Put the panel back as the tour found it, once.
async function restorePanel(): Promise<void> {
  const wasOpen = panelOpenAtStart;
  panelOpenAtStart = null;
  if (wasOpen === null) return;
  if (wasOpen) await openPanel();
  else closePanel();
}

const panelOpen = () => findTour('avatar-character') !== null;

// Open the panel the way a person would: press the Avatar button.
async function openPanel(): Promise<void> {
  if (panelOpen()) return;
  if (!clickTour('avatar-button')) return;
  await waitForTour('avatar-character', 1500);
}

function closePanel(): void {
  if (panelOpen()) clickTour('avatar-button');
}

// Nothing to drive beyond the DOM: the tour makes no content (spec "Tour content").
export type AvatarTourApi = Record<string, never>;

export type AvatarTourStep = TourStepOf<AvatarTourApi> & {
  // Left out for someone who may not speak (a Viewer).
  speaks?: boolean;
  // The body on a phone, where there is no Enter key.
  mobileBody?: string;
};

export const AVATAR_TOUR_STEPS: AvatarTourStep[] = [
  {
    id: 'avatar-button',
    title: 'Your Avatar',
    body: 'Your character sheet, and everything your character can do.',
    target: 'avatar-button',
    // The panel as the tour found it, taken once as the tour starts (Back to here keeps it).
    prepare: () => {
      panelOpenAtStart ??= panelOpen();
    },
  },
  {
    id: 'character',
    title: 'Make It Yours',
    body: 'Pick an outfit, hair and size, or roll the dice. Set a status so people know if you are free. Right-click your character to swap gender. Your shirt is always your colour.',
    // No right-click on a phone.
    mobileBody:
      'Pick an outfit, hair and size, or roll the dice. Set a status so people know if you are free. Your shirt is always your colour.',
    target: 'avatar-character',
    prepare: openPanel,
  },
  {
    id: 'actions',
    title: 'Behaviour and Reactions',
    body: 'Wave, spin, dance or throw confetti. Everyone sees it.',
    target: 'avatar-actions',
    prepare: openPanel,
  },
  {
    id: 'message',
    title: 'Say Something',
    body: 'Press Enter, or this button, to say something. It floats above your head for everyone.',
    mobileBody: 'Type a message and it floats above your head for everyone.',
    target: 'avatar-message',
    speaks: true,
    prepare: openPanel,
  },
  {
    id: 'push',
    title: 'Give Someone a Push',
    body: "Click someone else's character to walk over and give them a playful push. Arrow keys walk you around, and Space hops.",
    mobileBody: "Tap someone else's character to walk over and give them a playful push.",
    target: 'avatar-self',
    prepare: closePanel,
  },
  {
    id: 'outro',
    card: 'outro',
    title: "You're Ready to Roam",
    body: 'Walk around and say hello.',
    // Leave the panel as the tour found it.
    prepare: restorePanel,
  },
];

/**
 * The steps this person gets, filtered up front so the count stays honest: no Say Something for someone who may
 * not speak, and each step's phone wording on a phone.
 */
export function avatarTourSteps({
  canSpeak,
  mobile,
}: {
  canSpeak: boolean;
  mobile: boolean;
}): AvatarTourStep[] {
  return AVATAR_TOUR_STEPS.filter((step) => canSpeak || !step.speaks).map((step) =>
    mobile && step.mobileBody ? { ...step, body: step.mobileBody } : step,
  );
}

/** Puts the panel back as the tour found it when it ends early (a Skip mid-way). */
export function tidyAvatarTour(): void {
  void restorePanel();
}

// Telemetry `type` token for a step-viewed event: 'avatar-button' → 'AvatarTourStepAvatarButton'.
export function avatarTourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('AvatarTourStep', stepId);
}
