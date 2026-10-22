// The engine's hot paths held to their budgets (docs/specs/031-photo/blueprints/photo-engine.md
// "Performance and limits"), each the median of a few runs, with an allowance for slower machines.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@livedesign/vitest-config/cpu-time';
import { applyAdjustment } from './adjust/catalogue';
import { compositePhoto } from './composite/composite';
import { FILTERS } from './filters/catalogue';
import { diffPhoto } from './model/ops';
import type { Photo, PhotoLayer } from './model/types';
import { contentAwareFill } from './paint/patchmatch';
import { StrokeEngine } from './paint/stroke';
import { createRaster, setPixel, solidRaster } from './raster/raster';
import { TiledRaster } from './raster/tiles';
import { floodSelect } from './select/flood';
import { selectSubject } from './select/grabcut';

// Budgets are for an Apple M1, in CPU time (so a busy machine does not fail them), with an allowance
// for slower machines; CI and coverage get cpuBudgetMs's headroom on top.
const ALLOWANCE = Number(process.env.PHOTO_PERF_ALLOWANCE ?? 2);

/** The fastest of a few runs, in CPU ms. */
function median(fn: () => void, runs = 3): number {
  let best = Infinity;
  for (let i = 0; i < runs; i++) best = Math.min(best, cpuMsOf(fn));
  return best;
}

function noisy(w: number, h: number): ReturnType<typeof createRaster> {
  const r = createRaster(w, h);
  let s = 1;
  for (let i = 0; i < r.data.length; i += 4) {
    s = (s * 1103515245 + 12345) >>> 0;
    r.data[i] = s & 255;
    r.data[i + 1] = (s >> 8) & 255;
    r.data[i + 2] = (s >> 16) & 255;
    r.data[i + 3] = 255;
  }
  return r;
}

const report = (name: string, ms: number, budget: number) => {
  console.info(`[photo perf] ${name}: ${ms.toFixed(1)} ms (budget ${budget} ms)`);
  expect(ms).toBeLessThan(cpuBudgetMs(budget * ALLOWANCE));
};

describe('budgets', { timeout: 120_000 }, () => {
  it('lays a 100 px soft dab', () => {
    const layer = new TiledRaster();
    const s = new StrokeEngine(
      { raster: layer, offset: { x: 0, y: 0 } },
      { size: 100, hardness: 0, opacity: 1, flow: 0.5, spacing: 0.25 },
      { kind: 'paint', colour: [255, 0, 0], blend: 'normal' },
    );
    s.begin({ x: 300, y: 300 });
    // 40 dabs along a 1000 px line.
    const ms = median(() => s.to({ x: 300 + Math.random() * 1000, y: 300 }), 5) / 40;
    report('dab', ms, 0.3 * 8);
  });

  it('composites a 512 tile of 10 layers', () => {
    const layers: PhotoLayer[] = [];
    const store = new Map<string, TiledRaster>();
    for (let i = 0; i < 10; i++) {
      const id = `ly-${i.toString(16).padStart(8, '0')}`;
      store.set(
        id,
        TiledRaster.fromRaster(solidRaster(512, 512, [i * 20, 100, 200 - i * 10, 200])),
      );
      layers.push({
        id,
        name: id,
        layerKind: 'pixel',
        pixels: { tiles: {} },
        ...(i % 3 === 1 ? { blend: 'multiply' as const } : {}),
      });
    }
    const photo = { width: 512, height: 512, layers };
    const ms = median(() =>
      compositePhoto(
        photo,
        { layer: (id) => store.get(id), mask: () => undefined },
        { x: 0, y: 0, width: 512, height: 512 },
      ),
    );
    report('composite tile x10', ms, 20);
  });

  it('applies a table adjustment to 12 MP', () => {
    const r = solidRaster(4000, 3000, [100, 120, 140, 255]);
    const ms = median(
      () => applyAdjustment(r, { id: 'levels', params: { rgb: { inBlack: 10, gamma: 1.2 } } }),
      3,
    );
    report('levels 12MP', ms, 60);
  });

  it('blurs 2048 x 2048 at radius 10', () => {
    const r = noisy(2048, 2048);
    const ms = median(
      () =>
        FILTERS['gaussian-blur']!.run(
          r,
          { radius: 10 },
          { seed: 1, foreground: [0, 0, 0], background: [255, 255, 255] },
        ),
      1,
    );
    // The blueprint's 1.5 s is for 4096 x 4096: a quarter of the pixels here.
    report('gaussian 2048² r10', ms, 1500 / 4);
  });

  it('floods 12 MP', () => {
    const r = solidRaster(4000, 3000, [10, 10, 10, 255]);
    const ms = median(() => floodSelect(r, 10, 10), 3);
    report('magic wand 12MP', ms, 150);
  });

  it('heals a 150 px blob', () => {
    const r = noisy(450, 450);
    const hole = new Uint8Array(450 * 450);
    for (let y = 150; y < 300; y++)
      for (let x = 150; x < 300; x++) if (Math.hypot(x - 225, y - 225) < 75) hole[y * 450 + x] = 1;
    const ms = median(() => contentAwareFill(r, hole), 1);
    report('spot heal 150px', ms, 400);
  });

  it('finds a subject at 512 x 384', () => {
    const r = solidRaster(512, 384, [40, 60, 200, 255]);
    for (let y = 100; y < 280; y++)
      for (let x = 150; x < 360; x++) setPixel(r, x, y, [220, 40, 40, 255]);
    const ms = median(() => selectSubject(r, 3), 1);
    // The blueprint's 3 s is at 1024 x 768: four times the pixels.
    report('grabcut 512x384', ms, 3000 / 4);
  });

  it('diffs a 100-layer photo with one change', () => {
    const layers: PhotoLayer[] = Array.from({ length: 100 }, (_, i) => ({
      id: `ly-${i.toString(16).padStart(8, '0')}`,
      name: `Layer ${i}`,
      layerKind: 'pixel',
      pixels: {
        tiles: Object.fromEntries(
          Array.from({ length: 150 }, (_, k) => [
            `${k % 15}.${Math.floor(k / 15)}`,
            'abcdefghijklmnopqrstuv',
          ]),
        ),
      },
    }));
    const before: Photo = { width: 8000, height: 5000, layers };
    const after: Photo = {
      ...before,
      layers: layers.map((l, i) => (i === 50 ? { ...l, name: 'x' } : l)),
    };
    const ms = median(() => diffPhoto(before, after), 5);
    report('diff 100 layers', ms, 2);
  });
});
