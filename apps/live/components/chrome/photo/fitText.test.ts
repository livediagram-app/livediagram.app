import { describe, expect, it } from 'vitest';
import { fitFontPx, WORDS_FONT } from './fitText';

// The words under a box fit the BOX (docs/specs/021-event-storming/event-storming.md Phase 9): the largest font, from
// the default down to a floor, at which they take at most two lines.
describe('fitFontPx', () => {
  it('keeps the default size when the words already fit', () => {
    expect(fitFontPx(() => true)).toBe(WORDS_FONT.max);
  });

  it('steps down to the largest size that fits', () => {
    expect(fitFontPx((px) => px <= 9)).toBe(9);
    expect(fitFontPx((px) => px <= 8.7)).toBe(8.5);
  });

  it('stops at the floor when nothing fits, and lets the clamp cut the rest', () => {
    expect(fitFontPx(() => false)).toBe(WORDS_FONT.min);
  });
});
