import { contrastRatio } from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import { PRISM_PALETTES, PRISM_STOPS, prismPalette } from './brand-prism';

// The editor tints the mark from the active tab's theme stroke. These are the
// strokes the built-in themes carry, from saturated to near-black, grey and pale.
const THEME_STROKES = ['#db2777', '#15803d', '#7e22ce', '#0f172a', '#94a3b8', '#86efac', '#d6b78f'];
const HEX = /^#[0-9a-f]{6}$/;

describe('prismPalette', () => {
  it('shows the brand palette exactly with no accent', () => {
    for (const scheme of ['light', 'dark'] as const) {
      expect(prismPalette(scheme)).toBe(PRISM_PALETTES[scheme]);
      expect(prismPalette(scheme, null)).toBe(PRISM_PALETTES[scheme]);
    }
  });

  it('falls back to the brand palette for an accent it cannot read', () => {
    expect(prismPalette('light', 'red')).toBe(PRISM_PALETTES.light);
    expect(prismPalette('light', '#abc')).toBe(PRISM_PALETTES.light);
  });

  it('derives six in-gamut hex stops from any theme stroke', () => {
    for (const accent of THEME_STROKES) {
      for (const scheme of ['light', 'dark'] as const) {
        const palette = prismPalette(scheme, accent);
        for (const stop of PRISM_STOPS) expect(palette[stop], `${accent} ${stop}`).toMatch(HEX);
      }
    }
  });

  it('keeps the ramp ordered light to dark, as the brand is', () => {
    for (const accent of THEME_STROKES) {
      const p = prismPalette('light', accent);
      // Each step down the ramp is darker against white than the one before.
      const onWhite = (hex: string) => contrastRatio(hex, '#ffffff');
      expect(onWhite(p.highlight)).toBeLessThan(onWhite(p.light));
      expect(onWhite(p.light)).toBeLessThan(onWhite(p.vivid));
      expect(onWhite(p.deep)).toBeLessThan(onWhite(p.dark));
    }
  });

  it('holds lightness near the brand, so a near-black or pale accent still reads', () => {
    const brandVivid = contrastRatio(PRISM_PALETTES.dark.vivid, '#0f172a');
    for (const accent of ['#0f172a', '#86efac']) {
      const vivid = contrastRatio(prismPalette('dark', accent).vivid, '#0f172a');
      expect(vivid, accent).toBeGreaterThan(brandVivid * 0.6);
      expect(vivid, accent).toBeLessThan(brandVivid * 1.6);
    }
  });

  it('turns a grey accent into a grey cube', () => {
    const p = prismPalette('light', '#808080');
    for (const stop of PRISM_STOPS) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(p[stop].slice(i, i + 2), 16)) as [
        number,
        number,
        number,
      ];
      expect(Math.max(r, g, b) - Math.min(r, g, b), stop).toBeLessThanOrEqual(12);
    }
  });

  it('carries the accent hue onto the vivid stop', () => {
    const p = prismPalette('light', '#db2777');
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(p.vivid.slice(i, i + 2), 16)) as [
      number,
      number,
      number,
    ];
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it('derives a palette well inside a frame budget', () => {
    const start = performance.now();
    for (let i = 0; i < 200; i++)
      prismPalette(i % 2 ? 'light' : 'dark', THEME_STROKES[i % THEME_STROKES.length]);
    // 200 derivations; one theme change needs two.
    expect(performance.now() - start).toBeLessThan(100);
  });
});
