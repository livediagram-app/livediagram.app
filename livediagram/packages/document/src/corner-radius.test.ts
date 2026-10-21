import { describe, expect, it } from 'vitest';
import {
  BORDER_RADIUS_PX,
  CORNER_RADIUS_MAX_SHARE,
  cornerRadiusPx,
  type BorderRadius,
} from './border-style';

// docs/specs/008-canvas/corner-radius.md: a corner is the preset's px, never more than a quarter
// of the shorter side; Full is exempt, None is 0.
describe('cornerRadiusPx', () => {
  it('caps a preset at a quarter of the shorter side', () => {
    expect(CORNER_RADIUS_MAX_SHARE).toBe(0.25);
    // The operator's case: a 13.9 x 14.6 Excalidraw rounded square.
    expect(cornerRadiusPx('lg', 13.9, 14.6, 8)).toBeCloseTo(3.475, 6);
    expect(cornerRadiusPx('md', 14, 14, 8)).toBe(3.5);
    expect(cornerRadiusPx('sm', 10, 200, 8)).toBe(2.5);
  });

  it('draws every preset exactly as before once the shorter side is four times it', () => {
    for (const preset of ['none', 'sm', 'md', 'lg'] as BorderRadius[]) {
      const px = BORDER_RADIUS_PX[preset];
      for (const side of [4 * px, 4 * px + 1, 500]) {
        expect(cornerRadiusPx(preset, side, side * 3, 8)).toBe(px);
      }
    }
  });

  it('keeps Full a pill and None square at any size', () => {
    expect(cornerRadiusPx('full', 14, 14, 8)).toBe(BORDER_RADIUS_PX.full);
    expect(cornerRadiusPx('none', 14, 14, 8)).toBe(0);
  });

  it('caps an unset corner’s kind default the same way', () => {
    expect(cornerRadiusPx(undefined, 400, 400, 8)).toBe(8);
    expect(cornerRadiusPx(undefined, 16, 40, 8)).toBe(4);
    expect(cornerRadiusPx(undefined, 20, 20, 12)).toBe(5);
  });

  it('reads a broken or empty side as no room for a corner', () => {
    expect(cornerRadiusPx('md', 0, 50, 8)).toBe(0);
    expect(cornerRadiusPx('md', Number.NaN, 50, 8)).toBe(0);
    expect(cornerRadiusPx('md', -5, 50, 8)).toBe(0);
  });
});
