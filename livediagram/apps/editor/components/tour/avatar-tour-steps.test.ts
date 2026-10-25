import { describe, expect, it } from 'vitest';
import {
  AVATAR_TOUR_STEPS,
  avatarTourSteps,
  avatarTourStepTelemetryType,
} from './avatar-tour-steps';

// docs/specs/008-canvas/avatar-tour.md "The steps"
describe('the Avatar tour steps', () => {
  it('runs the button, the character, the actions, speaking and pushing, then the outro', () => {
    expect(AVATAR_TOUR_STEPS.map((s) => s.id)).toEqual([
      'avatar-button',
      'character',
      'actions',
      'message',
      'push',
      'outro',
    ]);
    expect(AVATAR_TOUR_STEPS.slice(0, -1).map((s) => s.target)).toEqual([
      'avatar-button',
      'avatar-character',
      'avatar-actions',
      'avatar-message',
      'avatar-self',
    ]);
  });

  it('leaves Say Something out for someone who may not speak', () => {
    expect(avatarTourSteps({ canSpeak: true, mobile: false }).map((s) => s.id)).toContain(
      'message',
    );
    expect(avatarTourSteps({ canSpeak: false, mobile: false }).map((s) => s.id)).not.toContain(
      'message',
    );
  });

  it('does not mention the Enter key on a phone', () => {
    const steps = avatarTourSteps({ canSpeak: true, mobile: true });
    for (const step of steps) expect(step.body).not.toMatch(/Enter|Arrow keys|Space/);
    expect(
      avatarTourSteps({ canSpeak: true, mobile: false }).find((s) => s.id === 'message')?.body,
    ).toMatch(/Enter/);
  });

  it('opens on a step, with no welcome card, and closes ready to roam', () => {
    expect(AVATAR_TOUR_STEPS[0]?.card).toBeUndefined();
    expect(AVATAR_TOUR_STEPS.at(-1)).toMatchObject({
      card: 'outro',
      title: "You're Ready to Roam",
    });
  });

  it('titles every step in Title Case, with no em dash anywhere', () => {
    for (const step of AVATAR_TOUR_STEPS.filter((s) => !s.card))
      for (const word of step.title.split(' ').filter((w) => w.length > 3))
        expect(word[0], step.title).toBe(word[0]!.toUpperCase());
    for (const step of AVATAR_TOUR_STEPS)
      expect(`${step.title} ${step.body} ${step.mobileBody ?? ''}`).not.toMatch(/—/);
  });

  it('names its step views', () => {
    expect(avatarTourStepTelemetryType('avatar-button')).toBe('AvatarTourStepAvatarButton');
  });

  it('teaches right-click to swap gender on a desktop, and not on a phone', () => {
    const character = (mobile: boolean) =>
      avatarTourSteps({ canSpeak: true, mobile }).find((s) => s.id === 'character')!.body;
    expect(character(false)).toMatch(/Right-click your character to swap gender/);
    expect(character(true)).not.toMatch(/Right-click/);
  });
});
