import { describe, expect, it } from 'vitest';
import { classifyRgb } from './classify';
import { rgbToHsv } from './colour';
import type { PaperFloors } from './floors';

// In deep shade a pixel's hue is sensor noise: a lilac note there reads
// anywhere from h 266 to 329, across the line between policy and hotspot, and
// half its paper would be each (spec/139 Phase 9).

const SHADED_KRAFT: PaperFloors = { saturation: 0.56, value: 0.2, wallHue: 21 };

describe('pink and lilac in deep shade', () => {
  it('reads a dim lilac pixel as the pink it cannot be told from', () => {
    for (const lilac of [
      { r: 71, g: 52, b: 71 },
      { r: 49, g: 41, b: 59 },
    ]) {
      expect(rgbToHsv(lilac).h).toBeLessThan(305);
      expect(classifyRgb(lilac.r, lilac.g, lilac.b, SHADED_KRAFT)).toBe('hotspot');
    }
  });

  it('still reads a dim pink pixel as a hotspot', () => {
    expect(classifyRgb(58, 41, 50, SHADED_KRAFT)).toBe('hotspot');
  });

  it('still reads a lit lilac as a policy', () => {
    const lilac = { r: 172, g: 150, b: 210 };
    expect(classifyRgb(lilac.r, lilac.g, lilac.b, SHADED_KRAFT)).toBe('policy');
  });
});
