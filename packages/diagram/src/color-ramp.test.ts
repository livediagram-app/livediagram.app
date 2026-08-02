import { describe, expect, it } from 'vitest';
import { shade, tint } from './index';

// tint / shade spin one theme hue into the light → base → dark ramp the colour
// picker offers, and they have 60-odd call sites between them across the
// editor. colors.test.ts covers their neighbours (isLightColor,
// deriveShapeColours, deriveTextColorForBg) and never touched these two.
//
// The properties below are the ones a caller relies on without saying so: that
// the ends of the ramp are white and black, that the middle moves the right
// way, that anything handed back is a valid hex the DOM will accept, and — the
// one the implementation comment promises and nothing checked — that an
// unparseable colour comes back unchanged instead of becoming garbage.

const HUES = ['#0ea5e9', '#f43f5e', '#334155', '#ffffff', '#000000'];

/** Perceived brightness of a hex, so "lighter" and "darker" are measurable. */
function brightness(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(hex);
  if (!m) throw new Error(`not a hex: ${hex}`);
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((h) => parseInt(h, 16)) as [number, number, number];
  return (r * 299 + g * 587 + b * 114) / 1000;
}

const rampOf = (f: (h: string, a: number) => string, hex: string) =>
  [0, 0.25, 0.5, 0.75, 1].map((a) => brightness(f(hex, a)));

describe('tint', () => {
  it('returns the colour unchanged at zero', () => {
    for (const h of HUES) expect(tint(h, 0)).toBe(h);
  });

  it('reaches white at one', () => {
    for (const h of HUES) expect(tint(h, 1)).toBe('#ffffff');
  });

  it('gets strictly lighter as the amount grows', () => {
    // Monotonic in perceived brightness: every step up the ramp must be
    // lighter than the last, or the picker's swatches read out of order.
    for (const hue of ['#334155', '#0ea5e9', '#f43f5e']) {
      const ramp = rampOf(tint, hue);
      expect(ramp).toEqual([...ramp].sort((a, b) => a - b));
      expect(new Set(ramp).size).toBe(ramp.length);
    }
  });
});

describe('shade', () => {
  it('returns the colour unchanged at zero', () => {
    for (const h of HUES) expect(shade(h, 0)).toBe(h);
  });

  it('reaches black at one', () => {
    for (const h of HUES) expect(shade(h, 1)).toBe('#000000');
  });

  it('gets strictly darker as the amount grows', () => {
    for (const hue of ['#334155', '#0ea5e9', '#f43f5e']) {
      const ramp = rampOf(shade, hue);
      expect(ramp).toEqual([...ramp].sort((a, b) => b - a));
      expect(new Set(ramp).size).toBe(ramp.length);
    }
  });
});

describe('both, on the shape of what they return', () => {
  it('always produces a six-digit lowercase hex', () => {
    // The results go straight into style attributes and SVG fills, so a
    // three-digit or unprefixed result would be a silent rendering bug.
    for (const h of HUES) {
      for (const a of [0.1, 0.33, 0.5, 0.9]) {
        expect(tint(h, a)).toMatch(/^#[0-9a-f]{6}$/);
        expect(shade(h, a)).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('accepts a hex without its leading hash', () => {
    expect(tint('0ea5e9', 1)).toBe('#ffffff');
    expect(shade('0ea5e9', 1)).toBe('#000000');
  });

  it('stays a valid hex when the amount runs past the ends of the ramp', () => {
    // Nothing clamps the caller's amount, so the channel maths can overshoot;
    // the conversion back to hex is what has to hold the line.
    for (const a of [-1, 2, 10]) {
      expect(tint('#0ea5e9', a)).toMatch(/^#[0-9a-f]{6}$/);
      expect(shade('#0ea5e9', a)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('hands an unparseable colour straight back', () => {
    // The documented failsafe. Themes carry user-authored colours (spec/44)
    // and older diagrams predate the hex-only rule, so a CSS name or an rgb()
    // string does reach here — it must pass through, not become '#NaNNaNNaN'.
    for (const bad of ['', 'rebeccapurple', 'rgb(1,2,3)', '#abc', 'not a colour']) {
      expect(tint(bad, 0.5)).toBe(bad);
      expect(shade(bad, 0.5)).toBe(bad);
    }
  });
});
