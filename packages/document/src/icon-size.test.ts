import { describe, expect, it } from 'vitest';
import { iconBandBounds, iconCaptionBand, isOnGlyphLabel } from './icon-size';

// docs/specs/010-palette/technology-icons.md "Middle-centre puts the label on the glyph" (issue #489).
const box = { x: 10, y: 20, width: 100, height: 50 };
const whole = { x: 10, y: 20, width: 100, height: 50 };
// The bands are fractions of the box, so compare to the pixel's thousandth.
const r = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 1000) / 1000 : v]),
  );

describe('isOnGlyphLabel', () => {
  it('is middle-centre only, with an unset horizontal reading as centre', () => {
    expect(isOnGlyphLabel({ textAlignX: 'center', textAlignY: 'middle' })).toBe(true);
    expect(isOnGlyphLabel({ textAlignY: 'middle' })).toBe(true);
    expect(isOnGlyphLabel({})).toBe(false); // the icon default, a bottom caption
    expect(isOnGlyphLabel({ textAlignX: 'left', textAlignY: 'middle' })).toBe(false);
    expect(isOnGlyphLabel({ textAlignX: 'center', textAlignY: 'top' })).toBe(false);
  });
});

describe('a middle-centre label', () => {
  const el = { ...box, label: '💀', textAlignX: 'center' as const, textAlignY: 'middle' as const };

  it('leaves the glyph the whole box, as if unlabelled', () => {
    expect(iconBandBounds(el)).toEqual(whole);
    expect(iconBandBounds({ ...box })).toEqual(whole);
  });

  it('centres the label over the whole box', () => {
    expect(iconCaptionBand(el)).toEqual({ ...whole, valign: 'middle' });
  });
});

describe('captions beside the glyph are unchanged', () => {
  it('bottom caption: glyph in the top band, caption in the bottom 36%', () => {
    const el = { ...box, label: 'EC2' };
    expect(r(iconBandBounds(el))).toEqual({ x: 10, y: 23, width: 100, height: 29 });
    expect(r(iconCaptionBand(el))).toEqual({
      x: 10,
      y: 52,
      width: 100,
      height: 18,
      valign: 'bottom',
    });
  });

  it('side caption on the middle row keeps its half', () => {
    const el = {
      ...box,
      label: 'EC2',
      textAlignX: 'right' as const,
      textAlignY: 'middle' as const,
    };
    expect(iconCaptionBand(el)).toEqual({ x: 60, y: 20, width: 50, height: 50, valign: 'middle' });
  });
});
