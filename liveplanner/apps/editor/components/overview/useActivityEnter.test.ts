// Recent Activity's entrance keeps the motion budget (docs/specs/004-interface-design/motion.md "The budget").
import { describe, expect, it } from 'vitest';
import { MOTION_CEILING_MS } from '@liveworkspace/style-guards/motion';
import { ACTIVITY_MAX, ACTIVITY_SHOWN } from './overview-activity';
import { activityEnterOf } from './useActivityEnter';

describe('activity entrance', () => {
  it('fans the first entries in one beat apart, every one landing by the ceiling', () => {
    const delays = Array.from(
      { length: ACTIVITY_SHOWN },
      (_, i) => activityEnterOf(i, false).delay,
    );
    expect(delays[0]).toBe(0);
    for (let i = 1; i < delays.length; i++) expect(delays[i]).toBeGreaterThan(delays[i - 1]!);
    for (let i = 0; i < ACTIVITY_MAX; i++)
      for (const late of [false, true]) {
        const { delay, duration } = activityEnterOf(i, late);
        expect(delay + duration).toBeLessThanOrEqual(MOTION_CEILING_MS);
      }
  });

  it('fans in what See All reveals from its first, and slides a new entry in at the top', () => {
    expect(activityEnterOf(ACTIVITY_SHOWN, true).delay).toBe(0);
    expect(activityEnterOf(ACTIVITY_SHOWN + 1, true).delay).toBeGreaterThan(0);
    const arriving = activityEnterOf(0, true);
    expect(arriving.delay).toBe(0);
    expect(arriving.keyframes).not.toBe(activityEnterOf(0, false).keyframes);
  });
});
