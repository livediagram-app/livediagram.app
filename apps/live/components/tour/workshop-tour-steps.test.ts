import { describe, expect, it } from 'vitest';
import {
  WORKSHOP_TOUR_STEPS,
  workshopTourSteps,
  workshopTourStepTelemetryType,
} from './workshop-tour-steps';

// The Workshop tour's steps (docs/specs/012-collaboration/workshop-tour.md "The steps").
describe('Workshop tour steps', () => {
  it('runs welcome, three steps, then the outro, in the spec order', () => {
    expect(WORKSHOP_TOUR_STEPS.map((s) => s.id)).toEqual([
      'welcome',
      'collaborate',
      'session-strip',
      'share',
      'outro',
    ]);
    expect(WORKSHOP_TOUR_STEPS[0]!.card).toBe('welcome');
    expect(WORKSHOP_TOUR_STEPS.at(-1)!.card).toBe('outro');
  });

  it('anchors every step between the bookends to the chrome it explains', () => {
    const anchors = WORKSHOP_TOUR_STEPS.filter((s) => !s.card).map((s) => s.target);
    expect(anchors).toEqual(['bar-collab-ask', 'session-tools', 'share']);
  });

  // The palette is the welcome tour's; this tour rings the session kit on the category bar alone.
  it('rings Ask and Session on the category bar', () => {
    const step = WORKSHOP_TOUR_STEPS.find((s) => s.id === 'collaborate')!;
    expect(step.target).toBe('bar-collab-ask');
    expect(step.alsoHighlight).toBe('bar-session');
  });

  it('leaves Share out where there is no Share button', () => {
    expect(workshopTourSteps({ canShare: false }).map((s) => s.id)).not.toContain('share');
    expect(workshopTourSteps({ canShare: true })).toHaveLength(WORKSHOP_TOUR_STEPS.length);
  });

  it('always opens on its own welcome card', () => {
    expect(workshopTourSteps({ canShare: true })[0]!.card).toBe('welcome');
    expect(workshopTourSteps({ canShare: false })[0]!.card).toBe('welcome');
  });

  it('names its telemetry by step', () => {
    expect(workshopTourStepTelemetryType('session-strip')).toBe('WorkshopTourStepSessionStrip');
    expect(workshopTourStepTelemetryType('collaborate')).toBe('WorkshopTourStepCollaborate');
  });
});
