import { describe, expect, it } from 'vitest';
import { textAdvanceEm } from './text-advance';

// Inter's drawn widths in em (packages/render-png/fonts/Inter-Regular.ttf, measured with canvas measureText at 100px,
// October 2026): what the estimate must not fall short of, so labels placed side by side never touch. system-ui and
// Arial draw these narrower still.
const INTER: Record<string, number> = {
  Home: 2.788,
  Food: 2.361,
  Travel: 2.858,
  Leisure: 3.423,
  Savings: 3.693,
  Revenue: 4.067,
  'Q1 2026': 3.966,
  Marketing: 4.724,
  WWW: 2.847,
  illicit: 2.108,
  'Monthly Income': 7.568,
};

describe('textAdvanceEm', () => {
  it('never falls short of the drawn width of a short label, wide letters and all', () => {
    for (const [word, drawn] of Object.entries(INTER)) {
      expect(textAdvanceEm(word)).toBeGreaterThanOrEqual(drawn);
      // And not so wide that a row of them wastes the strip.
      expect(textAdvanceEm(word)).toBeLessThan(drawn * 1.15);
    }
  });

  it('weighs narrow letters lighter than wide ones', () => {
    expect(textAdvanceEm('iiii')).toBeLessThan(textAdvanceEm('mmmm') / 2);
    expect(textAdvanceEm('')).toBe(0);
  });
});
