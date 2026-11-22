import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@liveworkspace/brand/colour';
import { mixHex } from '@liveworkspace/model-core/color-wash';
import { CHOSEN_HOVER_TINT, CHOSEN_TINT, chosenLabelInk } from './start-chosen-ink';

// Each product's start spec, "Rail": the chosen row's label reads at AA on its tint and on its hover.
const light = { surface: '#f8fafc', card: '#ffffff', text: '#0f172a' };
const dark = { surface: '#111827', card: '#0f172a', text: '#e2e8f0' };
const fillsOf = (p: { focus: string; surface: string; card: string }) =>
  [p.surface, p.card].flatMap((paper) =>
    [CHOSEN_TINT, CHOSEN_HOVER_TINT].map((pct) => mixHex(p.focus, paper, pct / 100)),
  );

describe('chosenLabelInk', () => {
  it('keeps an accent that already reads on its tints', () => {
    // A deep blue on its own light tint, and a light lime on its own dark tint.
    expect(chosenLabelInk({ ...light, focus: '#1e3a8a' })).toBe('#1e3a8a');
    expect(chosenLabelInk({ ...dark, focus: '#a3e635' })).toBe('#a3e635');
  });

  it.each([
    ['lime (liveknowledge)', '#4d7c0f'],
    ['sky', '#0284c7'],
    ['amber', '#f59e0b'],
  ])('leans a light accent toward the ink until it reads at AA: %s', (_name, focus) => {
    const palette = { ...light, focus };
    const ink = chosenLabelInk(palette);
    expect(ink).not.toBe(focus);
    for (const fill of fillsOf(palette))
      expect(contrastRatio(ink, fill)).toBeGreaterThanOrEqual(4.5);
    // The accent as it is did not.
    expect(Math.min(...fillsOf(palette).map((f) => contrastRatio(focus, f)))).toBeLessThan(4.5);
  });

  it('falls back to the ink itself when no lean of the accent reads', () => {
    // An ink as pale as its paper never reads: the function answers it rather than loop.
    const palette = { surface: '#ffffff', card: '#ffffff', text: '#fefefe', focus: '#ffffff' };
    expect(chosenLabelInk(palette)).toBe('#fefefe');
  });
});
