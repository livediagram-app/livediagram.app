import { describe, expect, it } from 'vitest';
import { BLEND_MODES } from '../model/blend-modes';
import { behindSpan, blendChannel, blendRgb, blendSpan, clearSpan, isSeparable } from './blend';
import {
  bytesToHex,
  hexToBytes,
  hslToRgb,
  hsvToRgb,
  lum,
  lumaByte,
  rgbToHsl,
  rgbToHsv,
  setSat,
  sat,
} from './colour';

const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('separable modes at reference points', () => {
  const cases: [string, number, number, number][] = [
    ['normal', 0.2, 0.7, 0.7],
    ['darken', 0.2, 0.7, 0.2],
    ['multiply', 0.5, 0.5, 0.25],
    ['colour-burn', 0.5, 0.5, 0],
    ['colour-burn', 1, 0.2, 1],
    ['colour-burn', 0.4, 0, 0],
    ['colour-burn', 0.8, 0.5, 0.6],
    ['linear-burn', 0.6, 0.7, 0.3],
    ['linear-burn', 0.2, 0.3, 0],
    ['lighten', 0.2, 0.7, 0.7],
    ['screen', 0.5, 0.5, 0.75],
    ['colour-dodge', 0.5, 0.5, 1],
    ['colour-dodge', 0, 0.9, 0],
    ['colour-dodge', 0.2, 0.5, 0.4],
    ['colour-dodge', 0.3, 1, 1],
    ['linear-dodge', 0.6, 0.7, 1],
    ['linear-dodge', 0.2, 0.3, 0.5],
    ['overlay', 0.25, 0.5, 0.25],
    ['overlay', 0.75, 0.5, 0.75],
    ['soft-light', 0.25, 0.75, 0.375],
    ['soft-light', 0.5, 0.25, 0.375],
    ['soft-light', 0.64, 0.75, 0.64 + 0.5 * (0.8 - 0.64)],
    ['hard-light', 0.5, 0.25, 0.25],
    ['hard-light', 0.5, 0.75, 0.75],
    ['vivid-light', 0.5, 0.75, 1],
    ['vivid-light', 0.5, 0.25, 0],
    ['vivid-light', 0.8, 0.25, 0.6],
    ['linear-light', 0.5, 0.6, 0.7],
    ['pin-light', 0.5, 0.2, 0.4],
    ['pin-light', 0.5, 0.9, 0.8],
    ['hard-mix', 0.5, 0.5, 1],
    ['hard-mix', 0.4, 0.5, 0],
    ['difference', 0.2, 0.7, 0.5],
    ['exclusion', 0.5, 0.5, 0.5],
    ['subtract', 0.7, 0.2, 0.5],
    ['subtract', 0.2, 0.7, 0],
    ['divide', 0.5, 0.5, 1],
    ['divide', 0.2, 0.5, 0.4],
    ['divide', 0.2, 0, 1],
    ['divide', 0, 0, 0],
  ];
  it.each(cases)('%s(%s, %s) = %s', (mode, b, s, want) => {
    close(blendChannel(mode as never, b, s)!, want);
  });

  it('answers undefined for non-separable modes', () => {
    expect(blendChannel('hue', 0.1, 0.2)).toBeUndefined();
    expect(isSeparable('hue')).toBe(false);
    expect(isSeparable('multiply')).toBe(true);
  });

  it('keeps every mode within 0..1', () => {
    for (const mode of BLEND_MODES) {
      for (const b of [0, 0.1, 0.5, 0.9, 1])
        for (const s of [0, 0.1, 0.5, 0.9, 1]) {
          const out = blendRgb(mode, [b, b * 0.5, 1 - b], [s, 1 - s, s * 0.3]);
          for (const v of out) {
            expect(v).toBeGreaterThanOrEqual(-1e-9);
            expect(v).toBeLessThanOrEqual(1 + 1e-9);
          }
        }
    }
  });
});

describe('non-separable modes', () => {
  it('colour keeps the backdrop luminosity with the source hue', () => {
    const [r, g, b] = blendRgb('colour', [0.5, 0.5, 0.5], [1, 0, 0]);
    close(r, 1);
    close(g, 0.5 + (-0.3 * 0.5) / 0.7);
    close(b, g);
    close(lum(r, g, b), 0.5, 1e-6);
  });
  it('luminosity takes the source luminosity', () => {
    const out = blendRgb('luminosity', [1, 0, 0], [0.2, 0.2, 0.2]);
    close(lum(...out), 0.2);
  });
  it('hue and saturation', () => {
    const hue = blendRgb('hue', [0.2, 0.6, 0.2], [1, 0, 0]);
    expect(hue[0]).toBeGreaterThan(hue[1]);
    close(lum(...hue), lum(0.2, 0.6, 0.2));
    const s = blendRgb('saturation', [0.2, 0.6, 0.2], [0.5, 0.5, 0.5]);
    close(sat(s), 0);
  });
  it('darker and lighter colour pick a whole colour', () => {
    expect(blendRgb('darker-colour', [0.9, 0.9, 0.9], [0.1, 0.2, 0.3])).toEqual([0.1, 0.2, 0.3]);
    expect(blendRgb('lighter-colour', [0.9, 0.9, 0.9], [0.1, 0.2, 0.3])).toEqual([0.9, 0.9, 0.9]);
  });
  it('setSat handles a grey', () => {
    expect(setSat([0.5, 0.5, 0.5], 0.4)).toEqual([0, 0, 0]);
  });
});

describe('blendSpan', () => {
  const px = (...v: number[]) => new Uint8ClampedArray(v);

  it('draws a half-opaque layer over an opaque backdrop', () => {
    const dst = px(0, 0, 255, 255);
    blendSpan(dst, 0, px(255, 0, 0, 255), 0, 1, 'normal', 0.5);
    expect([...dst]).toEqual([128, 0, 128, 255]);
  });

  it('shows the layer itself over transparency', () => {
    const dst = px(0, 0, 0, 0);
    blendSpan(dst, 0, px(10, 20, 30, 255), 0, 1, 'multiply', 1);
    expect([...dst]).toEqual([10, 20, 30, 255]);
    const half = px(0, 0, 0, 0);
    blendSpan(half, 0, px(10, 20, 30, 128), 0, 1, 'normal', 1);
    expect([...half]).toEqual([10, 20, 30, 128]);
  });

  it('multiplies over an opaque backdrop', () => {
    const dst = px(128, 255, 0, 255);
    blendSpan(dst, 0, px(128, 128, 255, 255), 0, 1, 'multiply', 1);
    expect([...dst]).toEqual([64, 128, 0, 255]);
  });

  it('mixes the blend with the source over a half transparent backdrop', () => {
    const dst = px(255, 255, 255, 128);
    blendSpan(dst, 0, px(0, 0, 0, 255), 0, 1, 'screen', 1);
    // Screen of white is white; half the backdrop is transparent so half shows the black source.
    expect(dst[3]).toBe(255);
    expect(Math.abs(dst[0]! - 128)).toBeLessThanOrEqual(1);
  });

  it('honours coverage and leaves uncovered pixels', () => {
    const dst = px(0, 0, 0, 255, 0, 0, 0, 255);
    blendSpan(
      dst,
      0,
      px(255, 255, 255, 255, 255, 255, 255, 255),
      0,
      2,
      'normal',
      1,
      new Uint8Array([0, 255]),
    );
    expect([...dst]).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });

  it('a non-separable mode over an opaque backdrop', () => {
    const dst = px(128, 128, 128, 255);
    blendSpan(dst, 0, px(255, 0, 0, 255), 0, 1, 'colour', 1);
    expect(dst[0]).toBeGreaterThan(dst[1]!);
  });

  it('paints behind and clears', () => {
    const dst = px(255, 0, 0, 255, 0, 0, 0, 0);
    behindSpan(dst, 0, px(0, 255, 0, 255, 0, 255, 0, 255), 0, 2, 1);
    expect([...dst]).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);
    behindSpan(dst, 0, px(0, 0, 255, 255), 0, 1, 1, new Uint8Array([0]));
    expect([...dst.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    clearSpan(dst, 0, 2, 0.5, new Uint8Array([255, 0]));
    expect(dst[3]).toBe(128);
    expect(dst[7]).toBe(255);
    clearSpan(dst, 4, 1, 1);
    expect(dst[7]).toBe(0);
  });
});

describe('colour conversions', () => {
  it('hex', () => {
    expect(hexToBytes('#ff8000')).toEqual([255, 128, 0]);
    expect(hexToBytes('nope')).toEqual([0, 0, 0]);
    expect(bytesToHex(255, 128.4, -3)).toBe('#ff8000');
  });
  it('round-trips HSL and HSV', () => {
    for (const c of [
      [1, 0, 0],
      [0.2, 0.4, 0.6],
      [0.9, 0.9, 0.1],
      [0.5, 0.5, 0.5],
      [0.1, 0.8, 0.3],
      [0.7, 0.2, 0.9],
    ] as [number, number, number][]) {
      const back = hslToRgb(...rgbToHsl(...c));
      const back2 = hsvToRgb(...rgbToHsv(...c));
      c.forEach((v, i) => {
        close(back[i]!, v, 1e-9);
        close(back2[i]!, v, 1e-9);
      });
    }
    expect(hsvToRgb(0, 0, 0)).toEqual([0, 0, 0]);
  });
  it('luma', () => {
    expect(lumaByte(255, 255, 255)).toBe(255);
    expect(lumaByte(255, 0, 0)).toBe(76);
  });
});
