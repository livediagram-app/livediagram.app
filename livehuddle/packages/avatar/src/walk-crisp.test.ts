import { describe, expect, it } from 'vitest';
import { AVATAR_HEIGHT, avatarPortraitBox, crispAvatarScale } from './walk';

// A sprite pixel at scale 1, in CSS px (the figure's grid is 24 high, drawn 4 px past its height).
const UNIT = (AVATAR_HEIGHT + 4) / 24;

describe('crispAvatarScale', () => {
  it('rounds down to whole CSS pixels per sprite pixel', () => {
    expect(crispAvatarScale(0.9) * UNIT).toBeCloseTo(2);
    expect(crispAvatarScale(1.4) * UNIT).toBeCloseTo(3);
    expect(crispAvatarScale(2) * UNIT).toBeCloseTo(5);
  });
  it('keeps at least one pixel, and leaves a whole size as it is', () => {
    expect(crispAvatarScale(0.1) * UNIT).toBeCloseTo(1);
    expect(crispAvatarScale(0.8)).toBeCloseTo(0.8);
  });
  it('gives a portrait a whole-pixel box', () => {
    const box = avatarPortraitBox(crispAvatarScale(1.4));
    expect(Number.isInteger(Math.round(box.width * 1e6) / 1e6)).toBe(true);
  });
});
