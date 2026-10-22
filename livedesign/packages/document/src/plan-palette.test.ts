import { PLAN_PRESET_HUES } from './plan-presets';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import { accentOn, liftAccent, planPalette, PLAN_BORDER_ACCENT_SHARE } from './plan-palette';
import { mixHex } from './svg-render-face-kit';

// docs/specs/026-plan/plan-board.md "Theme and style".
describe('planPalette', () => {
  it('is the surface neutral set for a board with no colours of its own', () => {
    expect(planPalette('light').surface).toBe('#f8fafc');
    expect(planPalette('dark').surface).toBe('#111827');
    expect(planPalette('light', { fill: null, stroke: undefined })).toEqual(planPalette('light'));
  });

  it("takes a board's fill, stroke and text, mixing columns and cards from them", () => {
    const p = planPalette('light', { fill: '#fef3c7', stroke: '#b45309', text: '#451a03' });
    expect(p.surface).toBe('#fef3c7');
    // The border is the accent mixed into the paper (quiet lines); focus keeps the full accent.
    expect(p.border).toBe(mixHex('#b45309', '#fef3c7', PLAN_BORDER_ACCENT_SHARE));
    expect(p.focus).toBe('#b45309');
    expect(p.text).toBe('#451a03');
    expect(p.column).not.toBe(p.surface);
    expect(p.card).not.toBe(p.surface);
  });

  it('swaps ink that would not read on the fill for a readable one', () => {
    const p = planPalette('light', { fill: '#1e1b4b', text: '#1e293b' });
    expect(contrastRatio(p.text, p.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('ignores a colour it cannot read', () => {
    expect(planPalette('light', { fill: 'transparent' })).toEqual(planPalette('light'));
  });
});

describe('type accents on dark surfaces', () => {
  it('lifts an accent too dark to see, and leaves the rest', () => {
    expect(contrastRatio(liftAccent('#18181b'), '#0f172a')).toBeGreaterThanOrEqual(3);
    expect(liftAccent('#eab308')).toBe('#eab308');
    expect(accentOn('#18181b', planPalette('light'))).toBe('#18181b');
    expect(accentOn('#18181b', planPalette('dark'))).toBe(liftAccent('#18181b'));
  });

  it('keeps muted words at WCAG AA on the column, a card and the board, plain or in any preset', () => {
    // At 62% of the ink every preset's muted text fell to about 3.8:1 (light) and 4.2:1 (dark), and the plain
    // light set's slate 500 to 4.3:1 on its column.
    for (const surface of ['light', 'dark'] as const)
      for (const preset of [undefined, ...PLAN_PRESET_HUES.map((h) => h.id)]) {
        const p = planPalette(surface, preset ? { preset } : {});
        for (const fill of [p.column, p.card, p.surface])
          expect(
            contrastRatio(p.muted, fill),
            `${surface} ${preset ?? 'plain'} on ${fill}`,
          ).toBeGreaterThanOrEqual(4.5);
      }
  });
});
