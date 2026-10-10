import { describe, expect, it } from 'vitest';
import {
  FACILITATE_TOUR_STEPS,
  facilitateTourSteps,
  facilitateTourStepTelemetryType,
} from './facilitate-tour-steps';

// The Facilitate tour's steps (docs/specs/012-collaboration/facilitate-tour.md "The steps").
describe('Facilitate tour steps', () => {
  it('runs welcome, five steps, then the outro, in the spec order', () => {
    expect(FACILITATE_TOUR_STEPS.map((s) => s.id)).toEqual([
      'welcome',
      'kit',
      'collaborate',
      'session-strip',
      'share',
      'modes',
      'outro',
    ]);
    expect(FACILITATE_TOUR_STEPS[0]!.card).toBe('welcome');
    expect(FACILITATE_TOUR_STEPS.at(-1)!.card).toBe('outro');
  });

  it('anchors every step between the bookends to the chrome it explains', () => {
    const anchors = FACILITATE_TOUR_STEPS.filter((s) => !s.card).map((s) => s.target);
    expect(anchors).toEqual([
      'palette',
      'palette-category-menu',
      'session-tools',
      'share',
      'editor-mode',
    ]);
  });

  it('leaves Share out where there is no Share button', () => {
    expect(facilitateTourSteps({ canShare: false }).map((s) => s.id)).not.toContain('share');
    expect(facilitateTourSteps({ canShare: true })).toHaveLength(FACILITATE_TOUR_STEPS.length);
  });

  it('names its telemetry by step', () => {
    expect(facilitateTourStepTelemetryType('session-strip')).toBe('FacilitateTourStepSessionStrip');
    expect(facilitateTourStepTelemetryType('kit')).toBe('FacilitateTourStepKit');
  });
});
