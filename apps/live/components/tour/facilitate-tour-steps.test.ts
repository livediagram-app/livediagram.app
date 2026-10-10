import { describe, expect, it } from 'vitest';
import {
  FACILITATE_TOUR_STEPS,
  facilitateTourSteps,
  facilitateTourStepTelemetryType,
} from './facilitate-tour-steps';

// The Facilitate tour's steps (docs/specs/012-collaboration/facilitate-tour.md "The steps").
describe('Facilitate tour steps', () => {
  it('runs welcome, three steps, then the outro, in the spec order', () => {
    expect(FACILITATE_TOUR_STEPS.map((s) => s.id)).toEqual([
      'welcome',
      'collaborate',
      'session-strip',
      'share',
      'outro',
    ]);
    expect(FACILITATE_TOUR_STEPS[0]!.card).toBe('welcome');
    expect(FACILITATE_TOUR_STEPS.at(-1)!.card).toBe('outro');
  });

  it('anchors every step between the bookends to the chrome it explains', () => {
    const anchors = FACILITATE_TOUR_STEPS.filter((s) => !s.card).map((s) => s.target);
    expect(anchors).toEqual(['band-collaborate', 'session-tools', 'share']);
  });

  // The palette is the welcome tour's; this tour rings the Collaborate band alone.
  it('rings the Collaborate band from its heading to its last category', () => {
    const step = FACILITATE_TOUR_STEPS.find((s) => s.id === 'collaborate')!;
    expect(step.target).toBe('band-collaborate');
    expect(step.alsoHighlight).toBe('option-collab-navigate');
  });

  it('leaves Share out where there is no Share button', () => {
    expect(facilitateTourSteps({ canShare: false }).map((s) => s.id)).not.toContain('share');
    expect(facilitateTourSteps({ canShare: true })).toHaveLength(FACILITATE_TOUR_STEPS.length);
  });

  it('starts at its first step when the welcome tour started it', () => {
    expect(facilitateTourSteps({ canShare: true, withWelcome: false })[0]!.id).toBe('collaborate');
  });

  it('names its telemetry by step', () => {
    expect(facilitateTourStepTelemetryType('session-strip')).toBe('FacilitateTourStepSessionStrip');
    expect(facilitateTourStepTelemetryType('collaborate')).toBe('FacilitateTourStepCollaborate');
  });
});
