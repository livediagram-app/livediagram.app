import { describe, expect, it } from 'vitest';
import { scrollLeftToReveal, TAB_REVEAL_PAD } from './tab-strip-scroll';

describe('scrollLeftToReveal', () => {
  const strip = { left: 60, right: 995, scrollLeft: 0 };

  it('scrolls a tab past the right edge just into view', () => {
    // The thirteenth tab of a full strip sat at 1028 to 1089, under Search.
    expect(scrollLeftToReveal(strip, { left: 1028, right: 1089 })).toBe(122);
  });

  it('scrolls back to a tab past the left edge', () => {
    expect(scrollLeftToReveal({ ...strip, scrollLeft: 300 }, { left: 20, right: 80 })).toBe(232);
  });

  it('leaves a tab that already shows where it is', () => {
    expect(scrollLeftToReveal({ ...strip, scrollLeft: 40 }, { left: 200, right: 260 })).toBe(40);
  });

  it('stops clear of the 20px edge fade, so a revealed tab is never half faded', () => {
    const left = scrollLeftToReveal(strip, { left: 1028, right: 1089 });
    // After the scroll the tab's right edge sits TAB_REVEAL_PAD inside the strip's.
    expect(strip.right - (1089 - left)).toBe(TAB_REVEAL_PAD);
    expect(TAB_REVEAL_PAD).toBeGreaterThan(20);
  });

  it('never scrolls before the start', () => {
    expect(scrollLeftToReveal({ ...strip, scrollLeft: 10 }, { left: 30, right: 90 })).toBe(0);
  });
});
