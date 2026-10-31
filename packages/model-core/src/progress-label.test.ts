import { describe, expect, it } from 'vitest';
import {
  clampPercent,
  PROGRESS_LABEL_PX,
  PROGRESS_RING_LABEL_MAX_PX,
  progressRingLabelPx,
} from './progress-label';

// docs/specs/009-elements/progress.md "The percentage's size".
describe('progressRingLabelPx', () => {
  it('scales with the ring: a fifth of its diameter', () => {
    expect(progressRingLabelPx(130, 130)).toBe(26);
    expect(progressRingLabelPx(180, 180)).toBe(36);
  });

  it('follows the shorter side, as the drawn ring does', () => {
    expect(progressRingLabelPx(300, 180)).toBe(36);
    expect(progressRingLabelPx(180, 300)).toBe(36);
  });

  it('keeps small rings readable at the floor', () => {
    expect(progressRingLabelPx(40, 40)).toBe(PROGRESS_LABEL_PX);
    expect(progressRingLabelPx(0, 0)).toBe(PROGRESS_LABEL_PX);
    expect(progressRingLabelPx(-10, 50)).toBe(PROGRESS_LABEL_PX);
  });

  it('stops at the ceiling on a very large ring', () => {
    expect(progressRingLabelPx(2000, 2000)).toBe(PROGRESS_RING_LABEL_MAX_PX);
  });

  it('falls back to the floor for a box with no size', () => {
    expect(progressRingLabelPx(Number.NaN, 100)).toBe(PROGRESS_LABEL_PX);
    expect(progressRingLabelPx(Infinity, Infinity)).toBe(PROGRESS_LABEL_PX);
  });

  it('rounds to whole px so the canvas and export agree', () => {
    expect(Number.isInteger(progressRingLabelPx(133, 133))).toBe(true);
  });
});

// A whole 0 to 100 share, shared by the progress elements and liveplanner's Percent fields.
describe('clampPercent', () => {
  it('rounds to a whole percentage', () => {
    expect(clampPercent(40.4)).toBe(40);
    expect(clampPercent(40.5)).toBe(41);
  });

  it('holds the value to 0 to 100', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(100)).toBe(100);
  });
});
