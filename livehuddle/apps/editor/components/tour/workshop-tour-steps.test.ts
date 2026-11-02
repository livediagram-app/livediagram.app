import { describe, expect, it, vi } from 'vitest';
import {
  WORKSHOP_TOUR_STEPS,
  workshopTourSteps,
  workshopTourStepTelemetryType,
} from './workshop-tour-steps';

// The Workshop tour's steps (docs/specs/012-collaboration/workshop-tour.md "The steps").
describe('Workshop tour steps', () => {
  it('runs six steps, then the outro, in the spec order', () => {
    expect(WORKSHOP_TOUR_STEPS.map((s) => s.id)).toEqual([
      'collaborate',
      'timer',
      'vote',
      'poll',
      'session-strip',
      'share',
      'outro',
    ]);
    expect(WORKSHOP_TOUR_STEPS[0]!.card).toBeUndefined();
    expect(WORKSHOP_TOUR_STEPS.at(-1)!.card).toBe('outro');
  });

  it('anchors its chrome steps to the chrome they explain', () => {
    const anchors = WORKSHOP_TOUR_STEPS.filter((s) => !s.card && s.target).map((s) => s.target);
    expect(anchors).toEqual(['bar-collab-ask', 'session-tools', 'share']);
  });

  // spec "Tour content": the session elements are the tour's own, placed once and shown one by one.
  it('places the session elements and shows each, by the id the host gave it', async () => {
    const api = { placeDemo: vi.fn(), demoId: (which: string) => `el-${which}` };
    for (const id of ['timer', 'vote', 'poll'] as const) {
      const step = WORKSHOP_TOUR_STEPS.find((s) => s.id === id)!;
      await step.prepare!(api);
      expect(step.selector!(api)).toBe(`[data-element-id="el-${id}"]`);
    }
    expect(api.placeDemo).toHaveBeenCalledTimes(3);
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

  it('opens on its first step, with no welcome card, shared or not', () => {
    expect(workshopTourSteps({ canShare: true })[0]!.id).toBe('collaborate');
    expect(workshopTourSteps({ canShare: false })[0]!.id).toBe('collaborate');
  });

  it('names its telemetry by step', () => {
    expect(workshopTourStepTelemetryType('session-strip')).toBe('WorkshopTourStepSessionStrip');
    expect(workshopTourStepTelemetryType('collaborate')).toBe('WorkshopTourStepCollaborate');
  });
});
