import { describe, expect, it } from 'vitest';
import { contrastRatio, planPalette } from '@livediagram/document';
import { accentOnWhite, inkOn, tourColourVars } from './tour-colours';

// docs/specs/007-editor/editor-tour.md "Look": the tour card wears the active tab's colours.
describe('tour colours', () => {
  it('reads the palette into the card, border, text, muted and accent variables', () => {
    const p = planPalette('light', { fill: '#fef3c7', stroke: '#b45309', text: '#451a03' });
    const vars = tourColourVars(p) as Record<string, string>;
    expect(vars['--tour-card']).toBe(p.card);
    expect(vars['--tour-border']).toBe(p.border);
    expect(vars['--tour-text']).toBe(p.text);
    expect(vars['--tour-muted']).toBe(p.muted);
    expect(vars['--tour-accent']).toBe(p.focus);
  });

  it('keeps the primary button text readable on its accent', () => {
    for (const accent of ['#b45309', '#1d4ed8', '#fde047', '#e2e8f0', '#0f172a']) {
      const ink = inkOn(accent);
      expect(contrastRatio(ink, accent), accent).toBeGreaterThanOrEqual(3);
    }
    expect(inkOn('#1d4ed8')).toBe('#ffffff');
    expect(inkOn('#fde047')).toBe('#0f172a');
  });

  it('keeps the banner button label readable on its white button, a dark tab’s pale accent included', () => {
    for (const accent of ['#60a5fa', '#fde047', '#e2e8f0', '#1d4ed8', '#b45309', '#22d3ee']) {
      expect(contrastRatio(accentOnWhite(accent), '#ffffff'), accent).toBeGreaterThanOrEqual(4.5);
    }
    // An accent that already reads is kept as it is.
    expect(accentOnWhite('#1d4ed8')).toBe('#1d4ed8');
    const dark = planPalette('dark', { fill: '#1e293b', stroke: '#60a5fa', text: '#e2e8f0' });
    const vars = tourColourVars(dark) as Record<string, string>;
    expect(contrastRatio(vars['--tour-accent-on-white']!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('falls back on brightness for a colour it cannot read as hex', () => {
    expect(['#ffffff', '#0f172a']).toContain(inkOn('rgb(10, 10, 10)'));
  });
});
