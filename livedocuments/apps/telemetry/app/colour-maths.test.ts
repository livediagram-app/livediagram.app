import { describe, expect, it } from 'vitest';
import { contrastRatio, shade } from './colour-maths';

describe('shade', () => {
  it('mixes toward white or black', () => {
    expect(shade('#000000', 0.5)).toBe('#808080');
    expect(shade('#ffffff', -0.5)).toBe('#808080');
    expect(shade('#0ea5e9', 0)).toBe('#0ea5e9');
  });
});

describe('contrastRatio', () => {
  it('spans 1:1 to 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#0ea5e9', '#131b26')).toBeCloseTo(contrastRatio('#131b26', '#0ea5e9'), 9);
  });

  it('matches the WCAG reference for a known pair', () => {
    // White on Tailwind's slate-500 is the well-known 4.76:1.
    expect(contrastRatio('#ffffff', '#64748b')).toBeCloseTo(4.76, 2);
  });
});
