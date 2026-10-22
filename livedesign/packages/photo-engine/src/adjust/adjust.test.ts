import { describe, expect, it } from 'vitest';
import { histogramOf } from '../histogram';
import { createRaster, pixelAt, setPixel, solidRaster } from '../raster/raster';
import {
  ADJUSTMENTS,
  ADJUSTMENT_IDS,
  LAYER_ADJUSTMENT_IDS,
  adjustmentForm,
  applyAdjustment,
  bake3dLut,
} from './catalogue';
import {
  autoColour,
  autoContrast,
  autoTone,
  curveTable,
  levelsLut,
  readCurves,
  readLevels,
} from './levels';
import {
  applyLut,
  composeLuts,
  identityLut,
  isIdentityLut,
  linearToSrgb,
  lutFromCurve,
  srgbToLinear,
} from './lut';
import { whiteBalanceFromNeutral, whiteBalanceGains, readWhiteBalance } from './tone';
import { bool, hex, num, oneOf, rec } from './params';
import type { AdjustmentId } from '../model/types';

const grey = (v: number) => solidRaster(1, 1, [v, v, v, 255]);
const one = (id: AdjustmentId, params: Record<string, unknown>, rgb: [number, number, number]) => {
  const r = solidRaster(1, 1, [...rgb, 255]);
  applyAdjustment(r, { id, params });
  return pixelAt(r, 0, 0);
};

describe('every adjustment', () => {
  it('is in the catalogue with a name, and layer ones exclude neighbourhood ones', () => {
    expect(ADJUSTMENT_IDS).toHaveLength(19);
    expect(LAYER_ADJUSTMENT_IDS).not.toContain('shadows-highlights');
    expect(LAYER_ADJUSTMENT_IDS).not.toContain('equalize');
    for (const id of ADJUSTMENT_IDS) expect(ADJUSTMENTS[id].name.length).toBeGreaterThan(2);
  });

  it('leaves the picture as it is at its defaults, where it has a neutral default', () => {
    const neutral: AdjustmentId[] = [
      'brightness',
      'levels',
      'curves',
      'exposure',
      'vibrance',
      'hue-saturation',
      'colour-balance',
      'white-balance',
      'channel-mixer',
      'selective-colour',
    ];
    for (const id of neutral) {
      expect(adjustmentForm({ id, params: {} }).kind, id).toBe('identity');
    }
    expect(adjustmentForm({ id: 'equalize', params: {} }).kind).toBe('identity');
  });

  it('keeps alpha', () => {
    for (const id of ADJUSTMENT_IDS) {
      const r = solidRaster(2, 2, [100, 150, 200, 77]);
      applyAdjustment(
        r,
        { id, params: { ...ADJUSTMENTS[id].defaults, brightness: 50 } },
        histogramOf(r),
      );
      expect(r.data[3], id).toBe(77);
    }
  });
});

describe('tone', () => {
  it('invert and posterize', () => {
    expect(one('invert', {}, [0, 100, 255])).toEqual([255, 155, 0, 255]);
    expect(one('posterize', { levels: 2 }, [100, 130, 255])).toEqual([0, 255, 255, 255]);
  });
  it('threshold by luma', () => {
    expect(one('threshold', { level: 128 }, [200, 200, 200])).toEqual([255, 255, 255, 255]);
    expect(one('threshold', { level: 128 }, [255, 0, 0])).toEqual([0, 0, 0, 255]);
  });
  it('brightness lifts midtones and keeps the ends', () => {
    expect(one('brightness', { brightness: 150 }, [0, 128, 255])[1]).toBeGreaterThan(180);
    expect(one('brightness', { brightness: 150 }, [0, 128, 255])[0]).toBe(0);
    expect(one('brightness', { brightness: 150 }, [0, 128, 255])[2]).toBe(255);
    expect(one('brightness', { contrast: 100 }, [100, 128, 160])[0]).toBeLessThan(80);
    expect(one('brightness', { contrast: -50 }, [0, 128, 255])[0]).toBeGreaterThan(50);
  });
  it('exposure doubles linear light per stop', () => {
    const [v] = one('exposure', { exposure: 1 }, [128, 128, 128]);
    expect(Math.abs(srgbToLinear(v / 255) - 2 * srgbToLinear(128 / 255))).toBeLessThan(0.01);
  });
  it('white balance warms and neutralises', () => {
    const [r, , b] = one('white-balance', { temperature: 50 }, [128, 128, 128]);
    expect(r).toBeGreaterThan(128);
    expect(b).toBeLessThan(128);
    const wb = whiteBalanceFromNeutral(200, 180, 150);
    const fixed = one('white-balance', { ...wb }, [200, 180, 150]);
    expect(Math.abs(fixed[0] - fixed[2])).toBeLessThanOrEqual(3);
    expect(Math.abs(fixed[1] - fixed[0])).toBeLessThanOrEqual(3);
    expect(whiteBalanceGains(readWhiteBalance({}))).toEqual([1, 1, 1]);
  });
  it('desaturate and equalize', () => {
    expect(one('desaturate', {}, [255, 0, 0])).toEqual([128, 128, 128, 255]);
    const r = createRaster(2, 1);
    setPixel(r, 0, 0, [50, 50, 50, 255]);
    setPixel(r, 1, 0, [60, 60, 60, 255]);
    applyAdjustment(r, { id: 'equalize', params: {} }, histogramOf(r));
    expect(pixelAt(r, 0, 0)[0]).toBe(0);
    expect(pixelAt(r, 1, 0)[0]).toBe(255);
  });
});

describe('Levels and Curves', () => {
  it('stretches input and maps output', () => {
    const lut = levelsLut(readLevels({ rgb: { inBlack: 50, inWhite: 200 } }));
    expect(lut[50]).toBe(0);
    expect(lut[200]).toBe(255);
    expect(lut[125]).toBe(128);
    const out = levelsLut(readLevels({ rgb: { outBlack: 20, outWhite: 220 } }));
    expect(out[0]).toBe(20);
    expect(out[255]).toBe(220);
    const gamma = levelsLut(readLevels({ rgb: { gamma: 2 } }));
    expect(gamma[64]).toBeGreaterThan(64);
  });
  it('applies a channel before the master', () => {
    const lut = levelsLut(readLevels({ red: { outWhite: 128 }, rgb: { inWhite: 128 } }));
    expect(lut[255]).toBe(255); // red 255 -> 128 -> 255
    expect(lut[256 + 255]).toBe(255);
  });
  it('reads bad levels as defaults and keeps white above black', () => {
    const l = readLevels({ rgb: { inBlack: 250, inWhite: 10, gamma: 'x' } });
    expect(l.rgb.inWhite).toBeGreaterThanOrEqual(l.rgb.inBlack + 2);
    expect(l.rgb.gamma).toBe(1);
  });
  it('curves pass through their points, monotone', () => {
    const t = curveTable([
      [0, 0],
      [64, 100],
      [192, 200],
      [255, 255],
    ]);
    expect(t[64]).toBeCloseTo(100);
    expect(t[192]).toBeCloseTo(200);
    for (let i = 1; i < 256; i++) expect(t[i]!).toBeGreaterThanOrEqual(t[i - 1]! - 1e-9);
    const flat = curveTable([
      [50, 10],
      [200, 240],
    ]);
    expect(flat[0]).toBe(10);
    expect(flat[255]).toBe(240);
    const c = readCurves({ rgb: [[0, 0], [10, 10, 1], 'x', [255, 200], [255, 255]], red: 'x' });
    expect(c.rgb).toEqual([
      [0, 0],
      [255, 255],
    ]);
    expect(c.red).toHaveLength(2);
    expect(
      one(
        'curves',
        {
          rgb: [
            [0, 255],
            [255, 0],
          ],
        },
        [0, 0, 0],
      ),
    ).toEqual([255, 255, 255, 255]);
    const steep = curveTable([
      [0, 0],
      [10, 200],
      [20, 205],
      [255, 255],
    ]);
    for (let i = 1; i < 256; i++) expect(steep[i]!).toBeGreaterThanOrEqual(steep[i - 1]! - 1e-9);
    const plateau = curveTable([
      [0, 0],
      [100, 100],
      [150, 100],
      [255, 255],
    ]);
    expect(plateau[125]).toBeCloseTo(100);
  });
  it('auto tone, contrast and colour stretch the histogram', () => {
    const r = createRaster(3, 1);
    setPixel(r, 0, 0, [40, 50, 60, 255]);
    setPixel(r, 1, 0, [100, 100, 100, 255]);
    setPixel(r, 2, 0, [200, 180, 160, 255]);
    const h = histogramOf(r);
    const tone = autoTone(h);
    expect(tone.red.inBlack).toBe(40);
    expect(tone.red.inWhite).toBe(200);
    const contrast = autoContrast(h);
    expect(contrast.red.inBlack).toBe(0);
    expect(contrast.rgb.inBlack).toBeGreaterThan(0);
    const colour = autoColour(h);
    expect(colour.red.gamma).toBeGreaterThan(0);
    const empty = autoTone(histogramOf(createRaster(1, 1)));
    expect(empty.red.inWhite).toBe(255);
  });
});

describe('colour adjustments', () => {
  it('hue/saturation shifts hue, desaturates, colourises', () => {
    const shifted = one('hue-saturation', { master: { hue: 120 } }, [255, 0, 0]);
    expect(shifted[1]).toBeGreaterThan(200);
    expect(one('hue-saturation', { master: { saturation: -100 } }, [255, 0, 0])).toEqual([
      128, 128, 128, 255,
    ]);
    const reds = one('hue-saturation', { ranges: { reds: { hue: 120 } } }, [255, 0, 0]);
    expect(reds[1]).toBeGreaterThan(200);
    const blueUntouched = one('hue-saturation', { ranges: { reds: { hue: 120 } } }, [0, 0, 255]);
    expect(blueUntouched).toEqual([0, 0, 255, 255]);
    const colourised = one(
      'hue-saturation',
      { colourise: true, master: { hue: 0, saturation: 100 } },
      [128, 128, 128],
    );
    expect(colourised[0]).toBeGreaterThan(colourised[2]);
    expect(one('hue-saturation', { master: { lightness: 100 } }, [10, 10, 10])).toEqual([
      255, 255, 255, 255,
    ]);
    expect(
      one('hue-saturation', { master: { saturation: 100 } }, [200, 100, 100])[0],
    ).toBeGreaterThan(200);
  });
  it('vibrance raises dull colours more than vivid ones', () => {
    const dull = one('vibrance', { vibrance: 100 }, [140, 120, 120]);
    const vivid = one('vibrance', { vibrance: 100 }, [250, 10, 10]);
    expect(dull[0] - dull[1]).toBeGreaterThan(20);
    expect(vivid[0] - vivid[1]).toBeGreaterThanOrEqual(239);
    expect(one('vibrance', { saturation: -100 }, [200, 100, 100])[0]).toBeLessThan(160);
  });
  it('colour balance moves midtones toward red', () => {
    const out = one(
      'colour-balance',
      { midtones: [100, 0, 0], preserveLuminosity: false },
      [128, 128, 128],
    );
    expect(out[0]).toBeGreaterThan(128);
    const kept = one('colour-balance', { midtones: [100, 0, 0] }, [128, 128, 128]);
    expect(kept[0]).toBeGreaterThan(kept[1]);
  });
  it('black and white by hue weights, and tints', () => {
    expect(one('black-white', {}, [255, 0, 0])).toEqual([102, 102, 102, 255]);
    expect(one('black-white', {}, [255, 255, 0])).toEqual([153, 153, 153, 255]);
    expect(one('black-white', { reds: 100 }, [255, 0, 0])).toEqual([255, 255, 255, 255]);
    const tinted = one('black-white', { tint: true, tintColour: '#ff0000' }, [128, 128, 128]);
    expect(tinted[0]).toBeGreaterThan(tinted[2]);
  });
  it('photo filter warms, channel mixer swaps', () => {
    const warm = one('photo-filter', { density: 1, preserveLuminosity: false }, [128, 128, 128]);
    expect(warm[0]).toBeGreaterThan(warm[2]);
    expect(
      one('channel-mixer', { red: [0, 0, 100, 0], blue: [100, 0, 0, 0] }, [10, 20, 30]),
    ).toEqual([30, 20, 10, 255]);
    expect(one('channel-mixer', { monochrome: true }, [100, 100, 100])).toEqual([
      100, 100, 100, 255,
    ]);
  });
  it('selective colour takes cyan out of reds, absolute and relative', () => {
    const rel = one('selective-colour', { ranges: { reds: [-100, 0, 0, 0] } }, [200, 50, 50]);
    expect(rel[0]).toBeGreaterThan(200);
    const abs = one(
      'selective-colour',
      { method: 'absolute', ranges: { reds: [100, 0, 0, 0] } },
      [200, 50, 50],
    );
    expect(abs[0]).toBeLessThan(200);
    expect(
      one('selective-colour', { ranges: { whites: [0, 0, 0, 50] } }, [250, 250, 250])[0],
    ).toBeLessThan(250);
    expect(
      one('selective-colour', { ranges: { blacks: [0, 0, 0, -50] } }, [20, 20, 20])[0],
    ).toBeGreaterThan(20);
  });
  it('gradient map by luma', () => {
    expect(one('gradient-map', {}, [255, 255, 255])).toEqual([255, 255, 255, 255]);
    const red = one(
      'gradient-map',
      {
        gradient: {
          colours: [
            { at: 0, colour: '#000000' },
            { at: 1, colour: '#ff0000' },
          ],
        },
      },
      [255, 255, 255],
    );
    expect(red).toEqual([255, 0, 0, 255]);
    expect(one('gradient-map', { reverse: true }, [255, 255, 255])).toEqual([0, 0, 0, 255]);
  });
  it('shadows/highlights lifts a dark area', () => {
    const r = grey(30);
    applyAdjustment(r, { id: 'shadows-highlights', params: { shadows: 100, radius: 1 } });
    expect(pixelAt(r, 0, 0)[0]).toBeGreaterThan(60);
    const h = grey(240);
    applyAdjustment(h, {
      id: 'shadows-highlights',
      params: { shadows: 0, highlights: 100, radius: 1 },
    });
    expect(pixelAt(h, 0, 0)[0]).toBeLessThan(220);
    const n = grey(100);
    applyAdjustment(n, { id: 'shadows-highlights', params: { shadows: 0, highlights: 0 } });
    expect(pixelAt(n, 0, 0)[0]).toBe(100);
  });
});

describe('tables', () => {
  it('compose, identity and apply', () => {
    const id = identityLut();
    expect(isIdentityLut(id)).toBe(true);
    const inv = lutFromCurve((v) => 1 - v);
    expect(isIdentityLut(composeLuts(inv, inv))).toBe(true);
    const r = solidRaster(1, 1, [10, 20, 30, 40]);
    applyLut(r, inv);
    expect([...r.data]).toEqual([245, 235, 225, 40]);
    for (const v of [0, 0.01, 0.2, 0.5, 1]) expect(linearToSrgb(srgbToLinear(v))).toBeCloseTo(v, 9);
  });
  it('bakes a 3D table at the corners exactly', () => {
    const lut = bake3dLut((r, g, b) => [b, g, r], 3);
    // r=1,g=0,b=0 is index 2.
    expect([...lut.slice(8, 12)]).toEqual([0, 0, 255, 255]);
    expect(lut).toHaveLength(3 * 3 * 3 * 4);
  });
  it('reads params within bounds', () => {
    expect(num({ a: 5 }, 'a', 0, 3, 1)).toBe(3);
    expect(num({ a: NaN }, 'a', 0, 3, 1)).toBe(1);
    expect(num(null, 'a', 0, 3, 1)).toBe(1);
    expect(bool({ a: true }, 'a', false)).toBe(true);
    expect(bool({}, 'a', false)).toBe(false);
    expect(rec({ a: [1] }, 'a')).toEqual({});
    expect(hex({ a: '#ABCDEF' }, 'a', '#000000')).toBe('#ABCDEF');
    expect(hex({ a: 'red' }, 'a', '#000000')).toBe('#000000');
    expect(oneOf({ a: 'x' }, 'a', ['y'] as const, 'y')).toBe('y');
  });
});
