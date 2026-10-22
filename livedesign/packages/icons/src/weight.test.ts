import { describe, expect, it } from 'vitest';

import {
  GLYPH_SIZES,
  ICON_SMALL_MAX_PX,
  ICON_STROKE_PX,
  ICON_STROKE_PX_SMALL,
  glyphStrokePx,
  strokeUnits,
} from './weight';

describe('glyphStrokePx', () => {
  it('draws 1.25px above the small threshold', () => {
    expect(ICON_STROKE_PX).toBe(1.25);
    expect(glyphStrokePx(14)).toBe(1.25);
    expect(glyphStrokePx(24)).toBe(1.25);
  });

  it('draws 1px at 12px and below', () => {
    expect(ICON_SMALL_MAX_PX).toBe(12);
    expect(ICON_STROKE_PX_SMALL).toBe(1);
    expect(glyphStrokePx(12)).toBe(1);
    expect(glyphStrokePx(9)).toBe(1);
  });
});

describe('strokeUnits', () => {
  it('converts on-screen px into viewBox units', () => {
    expect(strokeUnits(1.5, 16, 16)).toBe(1.5);
    expect(strokeUnits(1.5, 16, 24)).toBe(2.25);
    expect(strokeUnits(1.5, 24, 16)).toBe(1);
  });

  it('gives the same on-screen weight whatever the viewBox', () => {
    const onScreen = (units: number, size: number) =>
      (strokeUnits(1.5, size, units) * size) / units;
    expect(onScreen(16, 16)).toBe(onScreen(24, 20));
  });

  it('rejects a non-positive size or unit count', () => {
    expect(() => strokeUnits(1.5, 0, 24)).toThrow(RangeError);
    expect(() => strokeUnits(1.5, 16, Number.NaN)).toThrow(RangeError);
  });
});

describe('GLYPH_SIZES', () => {
  it('offers the five size steps', () => {
    expect(GLYPH_SIZES).toEqual([12, 14, 16, 20, 24]);
  });
});
