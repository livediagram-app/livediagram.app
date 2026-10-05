import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import { accentOn, liftAccent, planPalette } from './plan-palette';

// docs/specs/025-plan/plan-board.md "Theme and style".
describe('planPalette', () => {
  it('is the surface neutral set for a board with no colours of its own', () => {
    expect(planPalette('light').surface).toBe('#f8fafc');
    expect(planPalette('dark').surface).toBe('#111827');
    expect(planPalette('light', { fill: null, stroke: undefined })).toEqual(planPalette('light'));
  });

  it("takes a board's fill, stroke and text, mixing columns and cards from them", () => {
    const p = planPalette('light', { fill: '#fef3c7', stroke: '#b45309', text: '#451a03' });
    expect(p.surface).toBe('#fef3c7');
    expect(p.border).toBe('#b45309');
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
});
