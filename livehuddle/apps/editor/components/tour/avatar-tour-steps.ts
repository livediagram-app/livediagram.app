// The steps of the Avatar tour (docs/specs/008-canvas/avatar-tour.md "The steps"): the avatar palette, the look,
// Actions and React, speaking, pushing, then the outro. It changes nothing, and opens nothing: every step rings
// a part of the avatar palette, which is on screen for as long as the walk lasts.

import {
  stepTelemetryType,
  type TourStepOf,
} from '@liveworkspace/workbench/components/tour/tour-step';

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
    id: 'palette',
    title: 'Your Avatar Palette',
    body: 'While you walk, the palette dresses your character and holds everything it can do.',
    target: 'palette',
  },
  {
    id: 'character',
    title: 'Make It Yours',
    body: 'Pick your clothes, hair and hair colour, or press Randomise. Set a status so people know if you are free. Right-click your character to swap gender. Your shirt is always your colour.',
    // No right-click on a phone.
    mobileBody:
      'Pick your clothes, hair and hair colour, or press Randomise. Set a status so people know if you are free. Your shirt is always your colour.',
    target: 'avatar-character',
  },
  {
    id: 'actions',
    title: 'Actions and React',
    body: 'Wave, spin, dance or throw confetti, from the right of the palette.',
    target: 'avatar-actions',
  },
  {
    id: 'message',
    title: 'Say Something',
    body: 'Press Enter, or Say, to say something. It floats above your head for everyone.',
    mobileBody: 'Tap Say, type a message, and it floats above your head for everyone.',
    target: 'avatar-message',
    speaks: true,
  },
  {
    id: 'push',
    title: 'Give Someone a Push',
    body: "Click someone else's character to walk over and give them a playful push. Arrow keys walk you around, and Space hops.",
    mobileBody: "Tap someone else's character to walk over and give them a playful push.",
    target: 'avatar-self',
  },
  {
    id: 'outro',
    card: 'outro',
    title: "You're Ready to Roam",
    body: 'Walk around and say hello.',
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

// Telemetry `type` token for a step-viewed event: 'palette' → 'AvatarTourStepPalette'.
export function avatarTourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('AvatarTourStep', stepId);
}
