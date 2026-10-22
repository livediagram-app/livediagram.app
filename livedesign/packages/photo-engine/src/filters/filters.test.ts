import { describe, expect, it } from 'vitest';
import { createRaster, pixelAt, setPixel, solidRaster, type Raster } from '../raster/raster';
import { FILTER_CATEGORIES, FILTER_LIST, FILTERS, filterDefaults, filtersIn } from './catalogue';
import { fractalNoise, medianFilter, minMaxFilter, rng, valueNoise } from './helpers';
import { boxesForGauss, gaussianBlurPlane, gaussianKernel, planeFrom } from './kernel';
import { FilterCancelled, paramValue, readParams, type FilterContext } from './types';

const ctx = (extra: Partial<FilterContext> = {}): FilterContext => ({
  seed: 7,
  foreground: [0, 0, 0],
  background: [255, 255, 255],
  ...extra,
});

/** A small picture with structure: a gradient, a bright square and a dark line. */
function picture(w = 24, h = 20): Raster {
  const r = createRaster(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      setPixel(r, x, y, [
        Math.round((x / (w - 1)) * 255),
        Math.round((y / (h - 1)) * 200),
        90,
        255,
      ]);
  for (let y = 6; y < 12; y++) for (let x = 8; x < 14; x++) setPixel(r, x, y, [250, 250, 250, 255]);
  for (let x = 0; x < w; x++) setPixel(r, x, 15, [10, 10, 10, 255]);
  return r;
}

const run = (id: string, src: Raster, params: Record<string, unknown> = {}, c = ctx()) =>
  FILTERS[id]!.run(src, { ...filterDefaults(FILTERS[id]!), ...params }, c);

const spread = (r: Raster) => {
  let min = 255;
  let max = 0;
  for (let i = 0; i < r.data.length; i += 4) {
    min = Math.min(min, r.data[i]!);
    max = Math.max(max, r.data[i]!);
  }
  return max - min;
};

describe('the catalogue', () => {
  it('lists forty-four filters in nine categories, each runnable at its defaults', () => {
    expect(FILTER_LIST.length).toBe(44);
    expect(new Set(FILTER_LIST.map((f) => f.id)).size).toBe(44);
    for (const c of FILTER_CATEGORIES) expect(filtersIn(c).length).toBeGreaterThan(0);
    const src = picture();
    for (const f of FILTER_LIST) {
      const out = f.run(src, filterDefaults(f), ctx());
      expect(out.width, f.id).toBe(src.width);
      expect(out.height, f.id).toBe(src.height);
      expect(
        Number.isFinite(f.margin(filterDefaults(f))) || f.margin(filterDefaults(f)) === Infinity,
        f.id,
      ).toBe(true);
    }
  });

  it('is repeatable with the same seed', () => {
    for (const f of FILTER_LIST) {
      const a = f.run(picture(), filterDefaults(f), ctx());
      const b = f.run(picture(), filterDefaults(f), ctx());
      expect(a.data, f.id).toEqual(b.data);
    }
  });

  it('reads settings within their specs', () => {
    const g = FILTERS['gaussian-blur']!;
    expect(readParams(g.params, { radius: 9999 }).radius).toBe(250);
    expect(readParams(g.params, { radius: 'x' }).radius).toBe(4);
    const radial = FILTERS['radial-blur']!;
    expect(paramValue(radial.params[1]!, { method: 'zoom' })).toBe('zoom');
    expect(paramValue(radial.params[1]!, { method: 'nope' })).toBe('spin');
    expect(paramValue(radial.params[2]!, { centre: { x: 2, y: -1 } })).toEqual({ x: 1, y: 0 });
    expect(paramValue(radial.params[2]!, { centre: 'x' })).toEqual({ x: 0.5, y: 0.5 });
    const custom = FILTERS.custom!;
    expect(paramValue(custom.params[0]!, { kernel: [1] })).toEqual(custom.params[0]!.default);
    expect((paramValue(custom.params[0]!, { kernel: Array(25).fill(5000) }) as number[])[0]).toBe(
      999,
    );
    expect(paramValue(FILTERS['add-noise']!.params[2]!, { monochromatic: 'yes' })).toBe(false);
  });

  it('can be cancelled', () => {
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      run('median', picture(64, 64), { radius: 3 }, ctx({ signal: controller.signal })),
    ).toThrow(FilterCancelled);
  });
});

describe('blurs', () => {
  it('keep a flat colour flat and soften detail', () => {
    for (const id of [
      'gaussian-blur',
      'box-blur',
      'motion-blur',
      'radial-blur',
      'surface-blur',
      'lens-blur',
      'tilt-shift',
    ]) {
      const flat = run(id, solidRaster(16, 16, [100, 150, 200, 255]));
      expect(
        pixelAt(flat, 8, 8)
          .map((v, i) => Math.abs(v - [100, 150, 200, 255][i]!) <= 1)
          .every(Boolean),
        id,
      ).toBe(true);
    }
    const src = picture();
    expect(pixelAt(run('gaussian-blur', src, { radius: 2 }), 10, 8)[0]).toBeLessThan(250);
    expect(
      pixelAt(run('motion-blur', src, { distance: 10, angle: 90 }), 10, 15)[0],
    ).toBeGreaterThan(10);
    expect(pixelAt(run('radial-blur', src, { method: 'zoom', amount: 50 }), 2, 2)[3]).toBe(255);
    expect(
      pixelAt(run('surface-blur', src, { radius: 3, threshold: 10 }), 10, 8)[0],
    ).toBeGreaterThan(240);
    expect(pixelAt(run('lens-blur', src, { radius: 4, brightness: 100 }), 8, 5)[0]).toBeGreaterThan(
      pixelAt(src, 8, 5)[0],
    );
  });
  it('kernels and boxes', () => {
    const k = gaussianKernel(2);
    expect(k.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(boxesForGauss(10)).toHaveLength(3);
    const p = planeFrom(9, 1, [0, 0, 0, 0, 9, 0, 0, 0, 0]);
    const wide = gaussianBlurPlane(p, 40);
    expect(wide.data.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(gaussianBlurPlane(p, 0.01)).toBe(p);
  });
});

describe('sharpen and noise', () => {
  it('sharpens and finds detail', () => {
    const src = picture();
    for (const id of ['unsharp-mask', 'sharpen', 'sharpen-more'])
      expect(spread(run(id, src)), id).toBeGreaterThanOrEqual(spread(src));
    expect(pixelAt(run('unsharp-mask', src, { threshold: 255 }), 5, 5)).toEqual(pixelAt(src, 5, 5));
    expect(pixelAt(run('high-pass', solidRaster(10, 10, [70, 70, 70, 255])), 5, 5)).toEqual([
      128, 128, 128, 255,
    ]);
  });
  it('adds and reduces noise', () => {
    const flat = solidRaster(20, 20, [128, 128, 128, 255]);
    const noisy = run('add-noise', flat, { amount: 50 });
    expect(spread(noisy)).toBeGreaterThan(40);
    const mono = run('add-noise', flat, {
      amount: 50,
      monochromatic: true,
      distribution: 'uniform',
    });
    expect(pixelAt(mono, 3, 3)[0]).toBe(pixelAt(mono, 3, 3)[1]);
    expect(spread(run('reduce-noise', noisy))).toBeLessThan(spread(noisy));
    expect(spread(run('median', noisy, { radius: 2 }))).toBeLessThan(spread(noisy));
    const speck = solidRaster(10, 10, [0, 0, 0, 255]);
    setPixel(speck, 5, 5, [255, 255, 255, 255]);
    expect(pixelAt(run('dust-scratches', speck, { radius: 1, threshold: 10 }), 5, 5)[0]).toBe(0);
    expect(pixelAt(run('dust-scratches', speck, { radius: 1, threshold: 255 }), 5, 5)[0]).toBe(255);
    expect(pixelAt(run('despeckle', speck), 5, 5)[0]).toBe(255);
    const soft = solidRaster(10, 10, [10, 10, 10, 255]);
    setPixel(soft, 5, 5, [40, 40, 40, 255]);
    expect(pixelAt(run('despeckle', soft), 5, 5)[0]).toBe(10);
    expect(pixelAt(run('reduce-noise', flat, { strength: 0 }), 4, 4)).toEqual([128, 128, 128, 255]);
  });
  it('median and min/max', () => {
    const r = createRaster(5, 1);
    [10, 200, 30, 40, 50].forEach((v, x) => setPixel(r, x, 0, [v, v, v, 255]));
    expect(pixelAt(medianFilter(r, 1), 1, 0)[0]).toBe(30);
    expect(medianFilter(r, 0).data).toEqual(r.data);
    expect(pixelAt(minMaxFilter(r, 1, true), 0, 0)[0]).toBe(200);
    expect(pixelAt(minMaxFilter(r, 1, false), 2, 0)[0]).toBe(30);
    expect(minMaxFilter(r, 0, true).data).toEqual(r.data);
  });
});

describe('stylize and pixelate', () => {
  it('stylizes', () => {
    expect(pixelAt(run('emboss', solidRaster(8, 8, [50, 90, 10, 255])), 4, 4)).toEqual([
      128, 128, 128, 255,
    ]);
    expect(pixelAt(run('find-edges', solidRaster(8, 8, [50, 90, 10, 255])), 4, 4)).toEqual([
      255, 255, 255, 255,
    ]);
    expect(pixelAt(run('find-edges', picture()), 8, 8)[0]).toBeLessThan(200);
    expect(pixelAt(run('solarize', solidRaster(2, 2, [200, 100, 128, 255])), 0, 0)).toEqual([
      55, 100, 127, 255,
    ]);
    expect(pixelAt(run('oil-paint', solidRaster(8, 8, [5, 6, 7, 255])), 4, 4)).toEqual([
      5, 6, 7, 255,
    ]);
    expect(pixelAt(run('glowing-edges', solidRaster(8, 8, [200, 200, 200, 255])), 4, 4)[0]).toBe(0);
    for (const mode of ['normal', 'darken', 'lighten'])
      expect(run('diffuse', picture(), { mode }).width).toBe(24);
  });
  it('pixelates', () => {
    const mosaic = run('mosaic', picture(), { cell: 4 });
    expect(pixelAt(mosaic, 0, 0)).toEqual(pixelAt(mosaic, 3, 3));
    expect(
      pixelAt(
        run(
          'mosaic',
          picture(),
          { cell: 4 },
          ctx({ photo: { width: 24, height: 20, x: 2, y: 2 } }),
        ),
        1,
        1,
      ),
    ).toEqual(
      pixelAt(
        run(
          'mosaic',
          picture(),
          { cell: 4 },
          ctx({ photo: { width: 24, height: 20, x: 2, y: 2 } }),
        ),
        0,
        0,
      ),
    );
    const crystal = run('crystallize', solidRaster(20, 20, [1, 2, 3, 255]), { cell: 5 });
    expect(pixelAt(crystal, 10, 10)).toEqual([1, 2, 3, 255]);
    const ht = run('colour-halftone', solidRaster(20, 20, [255, 255, 255, 255]));
    expect(pixelAt(ht, 10, 10)).toEqual([255, 255, 255, 255]);
    const pts = run('pointillize', solidRaster(30, 30, [0, 0, 255, 255]), { cell: 10 });
    const colours = new Set<string>();
    for (let y = 0; y < 30; y++)
      for (let x = 0; x < 30; x++) colours.add(pixelAt(pts, x, y).join());
    expect(colours.has('255,255,255,255')).toBe(true);
    expect(colours.has('0,0,255,255')).toBe(true);
  });
});

describe('distortions', () => {
  it('keep a flat colour flat and move detail', () => {
    for (const id of [
      'pinch',
      'twirl',
      'spherize',
      'wave',
      'ripple',
      'polar-coordinates',
      'lens-correction',
    ]) {
      const flat = run(id, solidRaster(16, 16, [40, 80, 120, 255]));
      expect(pixelAt(flat, 8, 8), id).toEqual([40, 80, 120, 255]);
    }
    const src = picture();
    expect(run('twirl', src, { angle: 300 }).data).not.toEqual(src.data);
    expect(run('pinch', src, { amount: -80 }).data).not.toEqual(src.data);
    expect(run('spherize', src, { amount: -60 }).data).not.toEqual(src.data);
    expect(run('wave', src, { vertical: true, horizontal: false }).data).not.toEqual(src.data);
    expect(run('ripple', src, { size: 'large' }).data).not.toEqual(src.data);
    expect(run('ripple', src, { size: 'small' }).data).not.toEqual(src.data);
    expect(run('polar-coordinates', src, { direction: 'to-rect' }).data).not.toEqual(src.data);
    const lc = run('lens-correction', src, { distortion: 50, redCyan: 50, blueYellow: -50 });
    expect(lc.data).not.toEqual(src.data);
    const grey = solidRaster(20, 20, [200, 200, 200, 255]);
    const vig = run('lens-correction', grey, { vignette: -50 });
    expect(pixelAt(vig, 0, 0)[0]).toBeLessThan(pixelAt(vig, 10, 10)[0]);
  });
});

describe('render, enhance and other', () => {
  it('renders', () => {
    const cl = run('clouds', createRaster(30, 30));
    for (let i = 0; i < cl.data.length; i += 4) expect(cl.data[i + 3]).toBe(255);
    expect(spread(cl)).toBeGreaterThan(20);
    const dc = run('difference-clouds', solidRaster(10, 10, [255, 255, 255, 255]));
    expect(pixelAt(dc, 2, 2)[3]).toBe(255);
    const v = run('vignette', solidRaster(40, 40, [200, 200, 200, 255]), { amount: -100 });
    expect(pixelAt(v, 0, 0)[0]).toBeLessThan(pixelAt(v, 20, 20)[0]);
    const lighter = run('vignette', solidRaster(40, 40, [100, 100, 100, 255]), { amount: 100 });
    expect(pixelAt(lighter, 0, 0)[0]).toBeGreaterThan(100);
    const flare = run('lens-flare', solidRaster(60, 40, [20, 20, 20, 255]), {
      centre: { x: 0.3, y: 0.3 },
    });
    expect(pixelAt(flare, 18, 12)[0]).toBeGreaterThan(200);
    for (const lens of ['prime35', 'prime105'])
      expect(run('lens-flare', solidRaster(10, 10, [0, 0, 0, 255]), { lens }).width).toBe(10);
  });
  it('enhances', () => {
    const src = picture();
    expect(run('clarity', src, { amount: 0 })).toBe(src);
    expect(run('clarity', src, { amount: 80 }).data).not.toEqual(src.data);
    expect(run('clarity', src, { amount: -80 }).data).not.toEqual(src.data);
    const hazy = solidRaster(30, 30, [180, 180, 190, 255]);
    for (let x = 0; x < 15; x++)
      for (let y = 0; y < 30; y++) setPixel(hazy, x, y, [140, 150, 160, 255]);
    const clear = run('dehaze', hazy, { amount: 80 });
    expect(pixelAt(clear, 5, 5)[0]).toBeLessThan(140);
    expect(pixelAt(run('dehaze', hazy, { amount: -80 }), 5, 5)[0]).toBeGreaterThan(140);
    expect(
      spread(run('grain', solidRaster(30, 30, [128, 128, 128, 255]), { amount: 80 })),
    ).toBeGreaterThan(10);
  });
  it('offsets, maximum, minimum and custom', () => {
    const r = createRaster(4, 1);
    setPixel(r, 0, 0, [9, 9, 9, 255]);
    expect(pixelAt(run('offset', r, { horizontal: 1 }), 1, 0)[0]).toBe(9);
    expect(pixelAt(run('offset', r, { horizontal: -1 }), 3, 0)[0]).toBe(9);
    expect(pixelAt(run('offset', r, { horizontal: 1, edges: 'repeat' }), 0, 0)[0]).toBe(9);
    expect(pixelAt(run('offset', r, { horizontal: 1, edges: 'transparent' }), 0, 0)[3]).toBe(0);
    expect(pixelAt(run('maximum', r), 1, 0)[0]).toBe(9);
    expect(pixelAt(run('minimum', r), 0, 0)[0]).toBe(0);
    const identity = Array(25).fill(0);
    identity[12] = 1;
    const src = picture();
    expect(run('custom', src, { kernel: identity }).data).toEqual(src.data);
  });
  it('noise helpers stay in range', () => {
    const rand = rng(1);
    for (let i = 0; i < 100; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    const n = valueNoise(1.5, 2.5, 3);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(1);
    expect(fractalNoise(0.3, 0.7, 1)).toBeLessThanOrEqual(1);
  });
});
