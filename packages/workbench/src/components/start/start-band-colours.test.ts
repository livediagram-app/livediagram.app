import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@liveworkspace/brand/colour';
import { BAND_INK_CONTRAST, startBandColours, type StartBandInk } from './start-band-colours';

// Each product's start spec, "The header band": the band is the palette's accent mixed into its card, and the title
// and the line read at AA on every ground they can sit over.
const PALETTES: Record<string, StartBandInk> = {
  // The apps' own light and dark looks (start-palette.ts), with a brand accent each.
  light: { card: '#ffffff', text: '#0f172a', muted: '#5d6d83', focus: '#0284c7' },
  dark: { card: '#0f172a', text: '#e2e8f0', muted: '#94a3b8', focus: '#38bdf8' },
  rose: { card: '#ffffff', text: '#0f172a', muted: '#5d6d83', focus: '#be123c' },
  emerald: { card: '#0f172a', text: '#e2e8f0', muted: '#94a3b8', focus: '#34d399' },
  // A themed tab: warm paper and a strong accent.
  sepia: { card: '#f7f0df', text: '#3b2f1e', muted: '#6b5a40', focus: '#b45309' },
  // A mid-grey paper with ink only just at AA, and a loud accent: the band must lean back to keep it there.
  tight: { card: '#767676', text: '#000000', muted: '#1f1f1f', focus: '#ff0000' },
};

describe('a start header band’s colours', () => {
  it.each(Object.entries(PALETTES))(
    'keeps the title and the line at AA on every ground (%s)',
    (_, ink) => {
      const band = startBandColours(ink);
      for (const ground of [band.paper, band.soft, band.wash]) {
        expect(contrastRatio(ink.text, ground)).toBeGreaterThanOrEqual(BAND_INK_CONTRAST);
        expect(contrastRatio(band.muted, ground)).toBeGreaterThanOrEqual(BAND_INK_CONTRAST);
      }
    },
  );

  it('tints the band with the accent in light and in dark, deeper shade by shade', () => {
    for (const ink of [PALETTES.light!, PALETTES.dark!]) {
      const band = startBandColours(ink);
      expect(band.paper).not.toBe(ink.card);
      const away = (c: string) => contrastRatio(c, ink.card);
      expect(away(band.soft)).toBeGreaterThan(away(band.paper));
      expect(away(band.wash)).toBeGreaterThan(away(band.soft));
      expect(band.accent).toBe(ink.focus);
    }
  });

  it('follows a themed tab’s accent, so two themes give two bands', () => {
    expect(startBandColours(PALETTES.light!).paper).not.toBe(
      startBandColours(PALETTES.rose!).paper,
    );
  });

  it('keeps the palette’s muted line where it already reads, and leans it toward the ink where not', () => {
    // Slate 600 reads on every ground; the app's own muted (slate 500 leaned 8%) falls under AA on the deepest shade.
    const roomy = { ...PALETTES.light!, muted: '#475569' };
    expect(startBandColours(roomy).muted).toBe('#475569');
    const leaned = startBandColours(PALETTES.light!).muted;
    expect(leaned).not.toBe(PALETTES.light!.muted);
    expect(contrastRatio(leaned, '#ffffff')).toBeGreaterThan(
      contrastRatio(PALETTES.light!.muted, '#ffffff'),
    );
  });

  it('keeps a flat band, with no art, for a palette that is not plain hex', () => {
    const ink = { card: 'white', text: '#0f172a', muted: '#5d6d83', focus: '#0284c7' };
    const band = startBandColours(ink);
    expect(band.paper).toBe('white');
    expect(band.wash).toBe('white');
    expect(band.line).toBe('transparent');
    expect(band.muted).toBe(ink.muted);
  });
});
