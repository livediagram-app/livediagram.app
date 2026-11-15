import { describe, expect, it } from 'vitest';
import {
  BLUR_COPY_MAX,
  BLUR_COPY_MIN,
  blurCopyPlan,
  boxBlurRgba,
  boxRadiiForSigma,
} from './page-image-blur';

// docs/specs/007-editor/pages-mode.md "Image backgrounds", Blur.
describe('page picture blur', () => {
  it('picks three boxes whose passes blur as the sigma', () => {
    for (const sigma of [2, 3, 7.5, 20]) {
      const radii = boxRadiiForSigma(sigma);
      // Each box of width w adds (w^2 - 1) / 12 to the variance.
      const variance = radii.reduce((v, r) => v + ((2 * r + 1) ** 2 - 1) / 12, 0);
      expect(Math.sqrt(variance)).toBeGreaterThan(sigma * 0.85);
      expect(Math.sqrt(variance)).toBeLessThan(sigma * 1.15);
    }
  });

  it('keeps a flat picture flat, edges held (no dark fringe)', () => {
    const w = 20;
    const h = 10;
    const data = new Uint8ClampedArray(w * h * 4).fill(200);
    boxBlurRgba(data, w, h, 4);
    expect(Math.min(...data)).toBeGreaterThanOrEqual(199);
  });

  it('spreads a bright line and keeps its total', () => {
    const w = 41;
    const data = new Uint8ClampedArray(w * 4);
    for (let i = 0; i < w; i++) data[i * 4 + 3] = 255;
    data[20 * 4] = 255;
    boxBlurRgba(data, w, 1, 3);
    const reds = Array.from({ length: w }, (_, i) => data[i * 4]!);
    expect(reds[20]).toBeLessThan(255);
    expect(reds[17]).toBeGreaterThan(0);
    expect(reds.reduce((a, b) => a + b, 0)).toBeGreaterThan(200);
    expect(reds.reduce((a, b) => a + b, 0)).toBeLessThan(300);
  });

  it('does nothing for no blur or no pixels', () => {
    const data = new Uint8ClampedArray([1, 2, 3, 4]);
    boxBlurRgba(data, 1, 1, 0);
    boxBlurRgba(new Uint8ClampedArray(0), 0, 0, 3);
    expect(Array.from(data)).toEqual([1, 2, 3, 4]);
  });

  it('draws the copy small, within its bounds, with its own blur', () => {
    const page = { width: 1920, height: 1080 };
    const strong = blurCopyPlan({ width: 4000, height: 3000 }, page, 43.2);
    expect(Math.max(strong.width, strong.height)).toBeLessThanOrEqual(BLUR_COPY_MAX * 2);
    expect(strong.width).toBeGreaterThanOrEqual(BLUR_COPY_MIN);
    expect(strong.sigma).toBeGreaterThan(0);
    const soft = blurCopyPlan({ width: 4000, height: 3000 }, page, 2);
    expect(Math.max(soft.width, soft.height)).toBeLessThanOrEqual(BLUR_COPY_MAX * 2);
    expect(soft.width).toBeGreaterThan(strong.width);
    // A long panorama is held to twice the cap.
    const pano = blurCopyPlan({ width: 20000, height: 500 }, page, 2);
    expect(Math.max(pano.width, pano.height)).toBeLessThanOrEqual(BLUR_COPY_MAX * 2);
  });

  // The largest copy a page makes (1024 px on its long side) blurs within a CPU budget.
  it('blurs the largest copy within budget', () => {
    const plan = blurCopyPlan({ width: 4000, height: 3000 }, { width: 1920, height: 1080 }, 4.32);
    expect(plan.width).toBe(BLUR_COPY_MAX);
    const data = new Uint8ClampedArray(plan.width * plan.height * 4).fill(128);
    const start = process.cpuUsage();
    boxBlurRgba(data, plan.width, plan.height, plan.sigma);
    const used = process.cpuUsage(start);
    expect((used.user + used.system) / 1000).toBeLessThan(1000);
  });
});
