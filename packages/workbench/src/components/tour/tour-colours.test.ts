import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@liveworkspace/brand/colour';
import { inkOn, tourColourVars } from './tour-colours';

// docs/specs/007-editor/editor-tour.md "Look": the tour card wears the active tab's colours.
describe('tour colours', () => {
  it('reads the palette into the card, border, text, muted and accent variables', () => {
    const p = {
      card: '#fffbeb',
      border: '#fcd34d',
      text: '#451a03',
      muted: '#78350f',
      focus: '#b45309',
    };
    const vars = tourColourVars(p) as Record<string, string>;
    expect(vars['--tour-card']).toBe(p.card);
    expect(vars['--tour-border']).toBe(p.border);
    expect(vars['--tour-text']).toBe(p.text);
    expect(vars['--tour-muted']).toBe(p.muted);
    expect(vars['--tour-accent']).toBe(p.focus);
    expect(vars['--tour-on-accent']).toBe(inkOn(p.focus));
  });

  it('keeps the primary button text readable on its accent', () => {
    for (const accent of ['#b45309', '#1d4ed8', '#fde047', '#e2e8f0', '#0f172a']) {
      const ink = inkOn(accent);
      expect(contrastRatio(ink, accent), accent).toBeGreaterThanOrEqual(3);
    }
    expect(inkOn('#1d4ed8')).toBe('#ffffff');
    expect(inkOn('#fde047')).toBe('#0f172a');
  });

  it('takes the near-black on an accent it cannot read', () => {
    expect(inkOn('rebeccapurple')).toBe('#0f172a');
  });
});
