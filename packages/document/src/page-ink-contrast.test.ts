import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToRgb } from './colors';
import { inkToward, isOpaqueHex, mixHex, worstContrast } from './page-ink-contrast';

// docs/specs/007-editor/illustrate-pages.md "Re-inking": the least change, keeping the hue.
const hue = (hex: string) => {
  const { r, g, b } = hexToRgb(hex)!;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

describe('page ink contrast', () => {
  it('reads only #rrggbb', () => {
    expect(isOpaqueHex('#12abEF')).toBe(true);
    for (const v of ['transparent', '#fff', '#12345678', 'red', undefined]) {
      expect(isOpaqueHex(v)).toBe(false);
    }
  });

  it('measures the worst contrast over every tone', () => {
    expect(worstContrast('#000000', ['#ffffff', '#777777'])).toBeCloseTo(
      contrastRatio('#000000', '#777777'),
    );
    expect(worstContrast('#000000', [])).toBeNaN();
    expect(worstContrast('#000000', ['nope'])).toBeNaN();
  });

  it('mixes as a gradient interpolates', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('bad', '#ffffff', 0.5)).toBe('bad');
  });

  it('keeps a colour that clears its floor, and anything it cannot read', () => {
    expect(inkToward('#1e3a8a', ['#ffffff'], 3, 4.5)).toBe('#1e3a8a');
    expect(inkToward('transparent', ['#ffffff'], 3, 4.5)).toBe('transparent');
    expect(inkToward('#1e3a8a', [], 3, 4.5)).toBe('#1e3a8a');
  });

  it('moves the least that reaches the target, keeping the hue', () => {
    for (const [color, tone, target] of [
      ['#1e3a8a', '#0f172a', 4.5],
      ['#0ea5e9', '#ffffff', 3],
      ['#16a34a', '#14532d', 3],
      ['#fde68a', '#fef3c7', 4.5],
      ['#dc2626', '#b91c1c', 3],
    ] as const) {
      const out = inkToward(color, [tone], 3, target);
      const reached = contrastRatio(out, tone);
      expect(reached).toBeGreaterThanOrEqual(target);
      // The least change: within a hair of the target, never far past it.
      expect(reached).toBeLessThan(target + 0.25);
      if (out !== '#ffffff' && out !== '#000000') {
        const dh = Math.abs(hue(out) - hue(color));
        expect(Math.min(dh, 360 - dh)).toBeLessThan(12);
      }
    }
  });

  it('goes whichever way needs the smaller change', () => {
    // Pale on a white page: darker; navy on navy: lighter.
    expect(contrastRatio(inkToward('#e0f2fe', ['#ffffff'], 3, 4.5), '#000000')).toBeLessThan(
      contrastRatio('#e0f2fe', '#000000'),
    );
    expect(contrastRatio(inkToward('#1e3a8a', ['#1e3a8a'], 3, 3), '#ffffff')).toBeLessThan(
      contrastRatio('#1e3a8a', '#ffffff'),
    );
  });

  it('reads at every tone of a gradient, and takes the better end when none reaches', () => {
    const tones = ['#0f172a', '#1e3a8a'];
    expect(worstContrast(inkToward('#334155', tones, 3, 4.5), tones)).toBeGreaterThanOrEqual(4.5);
    // Black to white under one element: nothing reads on both; the end that reads best.
    const harsh = ['#000000', '#808080', '#ffffff'];
    const out = inkToward('#808080', harsh, 3, 4.5);
    expect(['#ffffff', '#000000']).toContain(out);
  });
});
