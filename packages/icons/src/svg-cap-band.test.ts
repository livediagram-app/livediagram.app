import { describe, expect, it } from 'vitest';
import { CAP_HEIGHT_EM, capBandBaselineY } from './svg-cap-band';

// SVG text in a shape sits on its cap band (docs/specs/004-interface-design/optical-alignment.md):
// alphabetic baseline, half the face's cap height below the shape's centre.
describe('capBandBaselineY', () => {
  it('uses the UI faces cap height (D27)', () => {
    expect(CAP_HEIGHT_EM).toBe(0.72);
  });

  it('puts the baseline half a cap height below the centre', () => {
    expect(capBandBaselineY(100, 10)).toBeCloseTo(103.6);
    expect(capBandBaselineY(0, 14)).toBeCloseTo(5.04);
  });

  it('leaves the cap band centred on the shape for any size', () => {
    for (const px of [9, 11, 14, 22]) {
      const baseline = capBandBaselineY(50, px);
      expect(baseline - (CAP_HEIGHT_EM * px) / 2).toBeCloseTo(50);
    }
  });
});
