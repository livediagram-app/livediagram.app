// Chart palettes (docs/specs/009-elements/pie-chart.md "Chart palettes"): a palette's first two colours are a chart's
// two largest slices or its first two series, so they stay plainly apart.
import { describe, expect, it } from 'vitest';
import { CHART_PALETTES } from './chart-palettes';

// CIELAB from sRGB hex (D65), for a ΔE (CIE76) between two colours.
function lab(hex: string): [number, number, number] {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [lin(1), lin(3), lin(5)];
  const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

describe('chart palettes', () => {
  it.each(CHART_PALETTES.filter((p) => p.id !== 'grey').map((p) => [p.id, p] as const))(
    '%s starts with two colours a reader tells apart',
    (_id, palette) => {
      expect(deltaE(palette.colors[0]!, palette.colors[1]!)).toBeGreaterThanOrEqual(15);
    },
  );

  it('measures a near pair as near: the old Forest start would fail', () => {
    expect(deltaE('#14532d', '#166534')).toBeLessThan(15);
    expect(deltaE('#000000', '#ffffff')).toBeCloseTo(100, 0);
  });
});
