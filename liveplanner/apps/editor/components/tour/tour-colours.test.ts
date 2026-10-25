import { describe, expect, it } from 'vitest';
import { BRAND_RAMP } from '@liveplanner/ui';
import { contrastRatio, hexToRgb, hueName, planPalette, rgbToHex } from '@liveplanner/project';
import {
  BANNER_FROM_CONTRAST,
  BANNER_INK,
  BANNER_TO_CONTRAST,
  bannerColours,
  inkOn,
  tourColourVars,
} from './tour-colours';

// White at `alpha` over `behind`, as the browser paints it.
function whiteAt(alpha: number, behind: string): string {
  const { r, g, b } = hexToRgb(behind)!;
  const over = (v: number) => v + (255 - v) * alpha;
  return rgbToHex({ r: over(r), g: over(g), b: over(b) });
}

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

  // docs/specs/007-editor/editor-tour.md "Look": the banners are the sign-in banner's deep gradient in the tab's hue,
  // in white. A dark tab's pale accent painted it a washed-out blue with its words in navy.
  const ACCENTS = [
    '#93c5fd',
    '#60a5fa',
    '#fde047',
    '#e2e8f0',
    '#1d4ed8',
    '#b45309',
    '#22d3ee',
    '#f0abfc',
  ];

  it('deepens any accent until white, and the 90% white copy, read on both ends of the banner', () => {
    for (const accent of ACCENTS) {
      const { from, to } = bannerColours(accent);
      expect(contrastRatio(BANNER_INK, from), accent).toBeGreaterThanOrEqual(BANNER_FROM_CONTRAST);
      expect(contrastRatio(BANNER_INK, to), accent).toBeGreaterThanOrEqual(BANNER_TO_CONTRAST);
      // The copy and the eyebrow are white at 90%: what that paints on the banner's lighter end still clears AA.
      expect(contrastRatio(whiteAt(0.9, from), from), accent).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the tab’s hue, so a Workshop banner is blue and a Plan one amber', () => {
    for (const accent of ['#93c5fd', '#b45309', '#22d3ee']) {
      expect(hueName(bannerColours(accent).from), accent).toBe(hueName(accent));
    }
  });

  it('gives the white button its label in the banner’s own colour, a dark tab’s pale accent included', () => {
    const dark = planPalette('dark', { fill: '#1e293b', stroke: '#60a5fa', text: '#e2e8f0' });
    const vars = tourColourVars(dark) as Record<string, string>;
    expect(contrastRatio(vars['--tour-banner-from']!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(vars['--tour-banner-to']!, '#ffffff')).toBeGreaterThanOrEqual(
      BANNER_TO_CONTRAST,
    );
  });

  it('falls back on the sign-in banner’s own gradient for an accent it cannot read', () => {
    expect(bannerColours('rgb(10, 10, 10)')).toEqual({
      from: BRAND_RAMP[700],
      to: BRAND_RAMP[800],
    });
  });

  it('falls back on brightness for a colour it cannot read as hex', () => {
    expect(['#ffffff', '#0f172a']).toContain(inkOn('rgb(10, 10, 10)'));
  });
});
