import { describe, expect, it } from 'vitest';
import { createMask } from '../raster/mask';
import { createRaster, pixelAt, setPixel, solidRaster, type Raster } from '../raster/raster';
import { TiledRaster } from '../raster/tiles';
import { rectMask } from '../select/shapes';
import { DabToolEngine, toneCurve, toneWeight } from './dab-tools';
import { blendOnto, bucketFill, colourRaster, gradientFill } from './fill';
import {
  fillGradientLine,
  gradientT,
  gradientTable,
  renderGradient,
  sampleGradient,
} from './gradient';
import { contentAwareFill } from './patchmatch';
import { poissonBlend } from './poisson';
import { removeRedEye } from './red-eye';
import { ellipseMasks, lineMask, rectangleMasks } from './shapes';
import { Smoother } from './smoothing';
import { StrokeEngine, type BrushSettings } from './stroke';
import { makeTip, roundFalloff, tipFor, tipOrigin } from './tip';

const brush = (extra: Partial<BrushSettings> = {}): BrushSettings => ({
  size: 10,
  hardness: 1,
  opacity: 1,
  flow: 1,
  spacing: 0.1,
  ...extra,
});

const BW = {
  colours: [
    { at: 0, colour: '#000000' },
    { at: 1, colour: '#ffffff' },
  ],
  opacities: [
    { at: 0, opacity: 1 },
    { at: 1, opacity: 1 },
  ],
};

describe('tips', () => {
  it('falls off from the hardness to the edge', () => {
    expect(roundFalloff(0, 0)).toBe(1);
    expect(roundFalloff(1, 0.5)).toBe(0);
    expect(roundFalloff(0.4, 0.5)).toBe(1);
    expect(roundFalloff(0.75, 0.5)).toBeGreaterThan(0);
    expect(roundFalloff(0.75, 0.5)).toBeLessThan(1);
  });
  it('makes round, square and aliased tips centred on their pixel', () => {
    const t = makeTip(5, 1);
    const o = tipOrigin(t, 10.5, 10.5);
    expect(t.data[Math.floor(t.size / 2) * t.size + Math.floor(t.size / 2)]).toBe(1);
    expect(o).toEqual({ x: 10 - Math.floor(t.size / 2), y: 10 - Math.floor(t.size / 2) });
    const sq = makeTip(4, 1, 'square', true, 0, 0);
    expect([...sq.data].filter((v) => v === 1)).toHaveLength(16);
    const one = makeTip(1, 1, 'round', true);
    expect([...one.data].filter((v) => v === 1)).toHaveLength(1);
    const soft = makeTip(20, 0);
    expect(soft.data[11 * soft.size + 15]!).toBeLessThan(1);
    expect(tipFor(10, 1, 'round', false, 0.5, 0.5)).toBe(tipFor(10, 1, 'round', false, 0.5, 0.5));
    for (let i = 0; i < 70; i++) tipFor(3 + i, 0.5, 'round', false, 0.5, 0.5);
    expect(makeTip(4, 1, 'square', false, 0, 0).data.some((v) => v > 0 && v < 1)).toBe(false);
    expect(makeTip(4, 1, 'square').data.some((v) => v > 0 && v < 1)).toBe(true);
  });
});

describe('strokes', () => {
  it('paints a line of the colour, no darker than one pass', () => {
    const layer = new TiledRaster();
    const s = new StrokeEngine(
      { raster: layer, offset: { x: 0, y: 0 } },
      brush({ flow: 0.5, opacity: 0.6 }),
      {
        kind: 'paint',
        colour: [255, 0, 0],
        blend: 'normal',
      },
    );
    s.begin({ x: 20, y: 20 });
    s.to({ x: 60, y: 20 });
    s.to({ x: 20, y: 20 });
    const rect = s.end();
    expect(rect).toBeNull();
    const a = layer.sample(40, 20, 3);
    expect(Math.abs(a - 153)).toBeLessThanOrEqual(1);
    expect(layer.sample(40, 20, 0)).toBe(255);
    expect(layer.sample(40, 40, 3)).toBe(0);
    expect(s.dabCount).toBeGreaterThan(10);
    expect(s.bounds!.width).toBeGreaterThan(40);
    expect(s.original.sample(40, 20, 3)).toBe(0);
  });

  it('erases, keeps locked alpha, and stays in the selection', () => {
    const layer = TiledRaster.fromRaster(solidRaster(100, 100, [0, 0, 255, 255]));
    const e = new StrokeEngine({ raster: layer, offset: { x: 0, y: 0 } }, brush(), {
      kind: 'erase',
    });
    e.begin({ x: 50, y: 50 });
    expect(layer.sample(50, 50, 3)).toBe(0);
    const locked = TiledRaster.fromRaster(solidRaster(100, 100, [0, 0, 255, 128]));
    const p = new StrokeEngine(
      { raster: locked, offset: { x: 0, y: 0 }, lockAlpha: true },
      brush(),
      {
        kind: 'paint',
        colour: [255, 255, 0],
        blend: 'normal',
      },
    );
    p.begin({ x: 50, y: 50 });
    expect(locked.sample(50, 50, 3)).toBe(128);
    expect(locked.sample(50, 50, 0)).toBeGreaterThan(200);
    const sel = new TiledRaster();
    const inSel = new StrokeEngine(
      { raster: sel, offset: { x: 0, y: 0 }, selection: rectMask(0, 0, 50, 100, false) },
      brush({ size: 20 }),
      { kind: 'paint', colour: [1, 2, 3], blend: 'normal' },
    );
    inSel.begin({ x: 50, y: 50 });
    expect(sel.sample(45, 50, 3)).toBe(255);
    expect(sel.sample(55, 50, 3)).toBe(0);
    // Locked alpha over nothing paints nothing.
    const empty = new TiledRaster();
    new StrokeEngine({ raster: empty, offset: { x: 0, y: 0 }, lockAlpha: true }, brush(), {
      kind: 'paint',
      colour: [9, 9, 9],
      blend: 'normal',
    }).begin({ x: 5, y: 5 });
    expect(empty.sample(5, 5, 3)).toBe(0);
  });

  it('paints at a layer offset, behind, clears, and by pressure', () => {
    const layer = TiledRaster.fromRaster(solidRaster(10, 10, [255, 0, 0, 255]));
    const s = new StrokeEngine({ raster: layer, offset: { x: 100, y: 100 } }, brush({ size: 4 }), {
      kind: 'paint',
      colour: [0, 255, 0],
      blend: 'behind',
    });
    s.begin({ x: 105, y: 105 });
    expect(layer.sample(5, 5, 0)).toBe(255);
    const behind = new StrokeEngine(
      { raster: layer, offset: { x: 100, y: 100 } },
      brush({ size: 4 }),
      {
        kind: 'paint',
        colour: [0, 255, 0],
        blend: 'behind',
      },
    );
    behind.begin({ x: 112, y: 112 });
    expect(layer.sample(12, 12, 1)).toBe(255);
    new StrokeEngine({ raster: layer, offset: { x: 100, y: 100 } }, brush({ size: 4 }), {
      kind: 'paint',
      colour: [0, 0, 0],
      blend: 'clear',
    }).begin({ x: 105, y: 105 });
    expect(layer.sample(5, 5, 3)).toBe(0);
    const pr = new TiledRaster();
    const pressure = new StrokeEngine(
      { raster: pr, offset: { x: 0, y: 0 } },
      brush({ size: 20, pressureSize: true, pressureOpacity: true }),
      {
        kind: 'paint',
        colour: [9, 9, 9],
        blend: 'multiply',
      },
    );
    pressure.begin({ x: 30, y: 30, pressure: 0.2 });
    expect(pr.sample(38, 30, 3)).toBe(0);
    expect(pr.sample(30, 30, 3)).toBeGreaterThan(0);
    expect(pr.sample(30, 30, 3)).toBeLessThan(80);
    expect(pressure.to({ x: 30, y: 30 })).toBeNull();
    const fresh = new StrokeEngine({ raster: new TiledRaster(), offset: { x: 0, y: 0 } }, brush(), {
      kind: 'erase',
    });
    expect(fresh.to({ x: 1, y: 1 })).not.toBeNull();
  });

  it('paints a mask and clones', () => {
    const mask = new TiledRaster(1, 255);
    new StrokeEngine({ raster: mask, offset: { x: 0, y: 0 } }, brush(), {
      kind: 'mask',
      value: 0,
    }).begin({ x: 10, y: 10 });
    expect(mask.sample(10, 10)).toBe(0);
    expect(mask.sample(30, 30)).toBe(255);
    const erased = new TiledRaster(1, 255);
    new StrokeEngine({ raster: erased, offset: { x: 0, y: 0 } }, brush(), { kind: 'erase' }).begin({
      x: 10,
      y: 10,
    });
    expect(erased.sample(10, 10)).toBe(0);
    const pic = createRaster(100, 20);
    for (let x = 0; x < 50; x++) for (let y = 0; y < 20; y++) setPixel(pic, x, y, [255, 0, 0, 255]);
    const layer = TiledRaster.fromRaster(pic);
    const clone = new StrokeEngine({ raster: layer, offset: { x: 0, y: 0 } }, brush(), {
      kind: 'clone',
      source: layer.clone(),
      offset: { x: -50, y: 0 },
    });
    clone.begin({ x: 75, y: 10 });
    expect(layer.sample(75, 10, 0)).toBe(255);
    expect(layer.sample(75, 10, 3)).toBe(255);
  });

  it('smooths a shaky line', () => {
    const s = new Smoother(1, 10);
    expect(s.push({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(s.push({ x: 5, y: 0 })).toBeNull();
    const p = s.push({ x: 20, y: 0 })!;
    expect(p.x).toBeCloseTo(10);
    expect(s.finish({ x: 20, y: 0 })).toEqual({ x: 20, y: 0 });
    expect(s.finish({ x: 20, y: 0 })).toBeNull();
    expect(new Smoother(0).push({ x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
  });
});

describe('dab tools', () => {
  const striped = () => {
    const r = createRaster(40, 40);
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < 40; x++) setPixel(r, x, y, x % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255]);
    return TiledRaster.fromRaster(r);
  };
  it('blurs and sharpens', () => {
    const layer = striped();
    const e = new DabToolEngine({ raster: layer, offset: { x: 0, y: 0 } }, brush({ size: 10 }), {
      kind: 'blur',
      strength: 1,
    });
    e.begin({ x: 20, y: 20 });
    e.to({ x: 24, y: 20 });
    const v = layer.sample(20, 20, 0);
    expect(v).toBeGreaterThan(40);
    expect(v).toBeLessThan(215);
    expect(e.bounds).not.toBeNull();
    const g = TiledRaster.fromRaster(solidRaster(40, 40, [128, 128, 128, 255]));
    g.write(solidRaster(1, 1, [180, 180, 180, 255]), 20, 20);
    new DabToolEngine({ raster: g, offset: { x: 0, y: 0 } }, brush(), {
      kind: 'sharpen',
      strength: 1,
      protectDetail: false,
    }).begin({
      x: 20,
      y: 20,
    });
    expect(g.sample(20, 20, 0)).toBeGreaterThan(180);
  });
  it('smudges colour along', () => {
    const r = createRaster(60, 20);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 30; x++) setPixel(r, x, y, [255, 0, 0, 255]);
    for (let y = 0; y < 20; y++) for (let x = 30; x < 60; x++) setPixel(r, x, y, [0, 0, 255, 255]);
    const layer = TiledRaster.fromRaster(r);
    const e = new DabToolEngine({ raster: layer, offset: { x: 0, y: 0 } }, brush({ size: 8 }), {
      kind: 'smudge',
      strength: 0.8,
    });
    e.begin({ x: 25, y: 10 });
    e.to({ x: 40, y: 10 });
    expect(layer.sample(36, 10, 0)).toBeGreaterThan(40);
    const finger = TiledRaster.fromRaster(solidRaster(20, 20, [0, 0, 0, 255]));
    new DabToolEngine({ raster: finger, offset: { x: 0, y: 0 } }, brush(), {
      kind: 'smudge',
      strength: 1,
      fingerColour: [255, 255, 255],
    }).begin({
      x: 10,
      y: 10,
    });
    expect(finger.sample(10, 10, 0)).toBe(255);
  });
  it('dodges, burns and sponges', () => {
    const mk = () => TiledRaster.fromRaster(solidRaster(20, 20, [128, 100, 100, 255]));
    const d = mk();
    new DabToolEngine({ raster: d, offset: { x: 0, y: 0 } }, brush(), {
      kind: 'dodge',
      range: 'midtones',
      exposure: 1,
      protectTones: false,
    }).begin({ x: 10, y: 10 });
    expect(d.sample(10, 10, 0)).toBeGreaterThan(128);
    const b = mk();
    new DabToolEngine({ raster: b, offset: { x: 0, y: 0 } }, brush(), {
      kind: 'burn',
      range: 'midtones',
      exposure: 1,
      protectTones: true,
    }).begin({ x: 10, y: 10 });
    expect(b.sample(10, 10, 0)).toBeLessThan(128);
    const s = mk();
    new DabToolEngine({ raster: s, offset: { x: 0, y: 0 } }, brush(), {
      kind: 'sponge',
      saturate: false,
      flow: 1,
      vibrance: false,
    }).begin({ x: 10, y: 10 });
    expect(s.sample(10, 10, 0) - s.sample(10, 10, 1)).toBeLessThan(28);
    const up = mk();
    new DabToolEngine({ raster: up, offset: { x: 0, y: 0 } }, brush(), {
      kind: 'sponge',
      saturate: true,
      flow: 1,
      vibrance: true,
    }).begin({ x: 10, y: 10 });
    expect(up.sample(10, 10, 0) - up.sample(10, 10, 1)).toBeGreaterThan(28);
    expect(toneWeight('shadows', 0.1)).toBeGreaterThan(toneWeight('shadows', 0.4));
    expect(toneWeight('highlights', 0.9)).toBeGreaterThan(0);
    expect(toneWeight('midtones', 0.5)).toBe(1);
  });
  it('dodges a stroke no further than its exposure, however many dabs cross a pixel', () => {
    const green = () => TiledRaster.fromRaster(solidRaster(80, 20, [36, 64, 28, 255]));
    const dodge = (layer: TiledRaster, back: boolean) => {
      const e = new DabToolEngine({ raster: layer, offset: { x: 0, y: 0 } }, brush({ size: 12 }), {
        kind: 'dodge',
        range: 'midtones',
        exposure: 0.5,
        protectTones: true,
      });
      e.begin({ x: 10, y: 10 });
      e.to({ x: 70, y: 10 });
      // Scrubbing back and forth in the same stroke adds nothing.
      if (back) {
        e.to({ x: 10, y: 10 });
        e.to({ x: 70, y: 10 });
      }
    };
    const once = green();
    dodge(once, false);
    const scrubbed = green();
    dodge(scrubbed, true);
    const px = (l: TiledRaster) => [0, 1, 2].map((c) => l.sample(40, 10, c));
    expect(px(scrubbed)).toEqual(px(once));
    const [r, g, b] = px(once) as [number, number, number];
    // Lighter, and still green: never washed toward grey or white.
    expect(g).toBeGreaterThan(64);
    expect(g).toBeLessThan(160);
    expect(g - Math.max(r, b)).toBeGreaterThan(30);
    // A second stroke builds on the first.
    dodge(once, false);
    expect(once.sample(40, 10, 1)).toBeGreaterThan(g);
  });
  it('bends levels with a curve that keeps black and white', () => {
    expect(toneCurve(0, 1, true)).toBe(0);
    expect(toneCurve(1, 1, false)).toBe(1);
    expect(toneCurve(0.25, 0.5, true)).toBeGreaterThan(0.25);
    expect(toneCurve(0.25, 0.5, false)).toBeLessThan(0.25);
    expect(toneCurve(0.4, 0, true)).toBe(0.4);
  });
  it('erases a background colour, contiguous, protecting the foreground', () => {
    const r = solidRaster(30, 30, [0, 200, 0, 255]);
    setPixel(r, 15, 12, [250, 250, 250, 255]);
    const layer = TiledRaster.fromRaster(r);
    const sel = createMask({ x: 0, y: 0, width: 30, height: 30 }, 255);
    const e = new DabToolEngine(
      { raster: layer, offset: { x: 0, y: 0 }, selection: sel },
      brush({ size: 12 }),
      {
        kind: 'background-eraser',
        tolerance: 50,
        continuous: true,
        contiguous: true,
        protect: [250, 250, 250],
      },
    );
    e.begin({ x: 15, y: 15 });
    expect(layer.sample(15, 15, 3)).toBeLessThan(10);
    expect(layer.sample(15, 12, 3)).toBe(255);
    e.to({ x: 16, y: 15 });
  });
});

describe('fills, gradients and shapes', () => {
  it('buckets a like area and gradients a selection', () => {
    const pic = solidRaster(20, 20, [255, 255, 255, 255]);
    for (let y = 0; y < 20; y++) setPixel(pic, 10, y, [0, 0, 0, 255]);
    const layer = solidRaster(20, 20, [255, 255, 255, 255]);
    // Only the like area's bounds are touched, and answered.
    expect(
      bucketFill(layer, { x: 0, y: 0 }, pic, { x: 2, y: 2 }, [255, 0, 0], { antiAlias: false }),
    ).toEqual({ x: 0, y: 0, width: 10, height: 20 });
    expect(pixelAt(layer, 2, 2)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(layer, 15, 2)).toEqual([255, 255, 255, 255]);
    const half = solidRaster(20, 20, [255, 255, 255, 255]);
    bucketFill(half, { x: 0, y: 0 }, pic, { x: 2, y: 2 }, [0, 0, 255], {
      selection: rectMask(0, 0, 5, 20, false),
      opacity: 1,
    });
    expect(pixelAt(half, 2, 2)[2]).toBe(255);
    expect(pixelAt(half, 7, 2)).toEqual([255, 255, 255, 255]);
    // A press outside the selection fills nothing.
    expect(
      bucketFill(half, { x: 0, y: 0 }, pic, { x: 15, y: 2 }, [0, 0, 255], {
        selection: rectMask(0, 0, 5, 20, false),
      }),
    ).toBeNull();
    const g = createRaster(20, 1);
    gradientFill(
      g,
      { x: 0, y: 0 },
      { x: 0, y: 0, width: 20, height: 1 },
      BW,
      'linear',
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { dither: false },
    );
    expect(pixelAt(g, 0, 0)[0]).toBeLessThan(15);
    expect(pixelAt(g, 19, 0)[0]).toBeGreaterThan(240);
    const gs = createRaster(20, 1);
    gradientFill(
      gs,
      { x: 0, y: 0 },
      { x: 0, y: 0, width: 20, height: 1 },
      BW,
      'linear',
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { selection: rectMask(10, 0, 20, 1, false) },
    );
    expect(pixelAt(gs, 5, 0)[3]).toBe(0);
    const at = solidRaster(4, 4, [0, 0, 0, 255]);
    blendOnto(
      at,
      { x: 10, y: 10 },
      colourRaster({ x: 0, y: 0, width: 30, height: 30 }, [255, 255, 255]),
      { x: 0, y: 0, width: 30, height: 30 },
      'normal',
      1,
    );
    expect(pixelAt(at, 0, 0)).toEqual([255, 255, 255, 255]);
    blendOnto(
      at,
      { x: 100, y: 100 },
      colourRaster({ x: 0, y: 0, width: 2, height: 2 }, [1, 1, 1]),
      { x: 0, y: 0, width: 2, height: 2 },
      'normal',
      1,
    );
  });

  it('samples and renders gradients in every style', () => {
    expect(sampleGradient(BW, 0.5).map(Math.round)).toEqual([128, 128, 128, 1]);
    expect(gradientTable(BW, true)[0]).toBe(255);
    const from = { x: 0, y: 0 };
    const to = { x: 10, y: 0 };
    expect(gradientT('linear', 5, 0, from, to)).toBeCloseTo(0.5);
    expect(gradientT('reflected', -5, 0, from, to)).toBeCloseTo(0.5);
    expect(gradientT('radial', 0, 5, from, to)).toBeCloseTo(0.5);
    expect(gradientT('diamond', 3, 5, from, to)).toBeCloseTo(0.5);
    expect(gradientT('angle', 0, 10, from, to)).toBeCloseTo(0.25);
    expect(gradientT('linear', 5, 0, from, from)).toBe(0);
    const r = renderGradient(
      BW,
      'radial',
      { x: 5, y: 5 },
      { x: 10, y: 5 },
      { x: 0, y: 0, width: 10, height: 10 },
    );
    expect(pixelAt(r, 5, 5)[0]).toBeLessThan(40);
    const line = fillGradientLine(100, 50, 0, 1, 'linear');
    expect(line.from.x).toBeCloseTo(0);
    expect(line.to.x).toBeCloseTo(100);
    expect(fillGradientLine(100, 50, 90, 1, 'radial').from).toEqual({ x: 50, y: 25 });
    const three = {
      colours: [
        { at: 0, colour: '#ff0000' },
        { at: 0.5, colour: '#00ff00' },
        { at: 1, colour: '#0000ff' },
      ],
      opacities: [{ at: 0, opacity: 1 }],
    };
    expect(sampleGradient(three, 0.5).slice(0, 3)).toEqual([0, 255, 0]);
    expect(sampleGradient(three, 2)[2]).toBe(255);
  });

  it('draws shapes', () => {
    const r = rectangleMasks({ x: 0, y: 0 }, { x: 10, y: 10 }, { strokeWidth: 2, radius: 3 });
    expect(r.fill!.data[5 * r.fill!.width + 5]).toBe(255);
    expect(r.fill!.data[0]).toBeLessThan(128);
    expect(r.stroke).not.toBeNull();
    expect(rectangleMasks({ x: 0, y: 0 }, { x: 0, y: 5 }).fill).toBeNull();
    const e = ellipseMasks({ x: 0, y: 0 }, { x: 10, y: 6 }, { strokeWidth: 2 });
    expect(e.fill!.data[3 * e.fill!.width + 5]).toBe(255);
    expect(ellipseMasks({ x: 0, y: 0 }, { x: 0, y: 0 }).fill).toBeNull();
    expect(ellipseMasks({ x: 0, y: 0 }, { x: 4, y: 4 }).stroke).toBeNull();
    const l = lineMask(
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { width: 2, endArrow: true, startArrow: true },
    )!;
    expect(l.width).toBeGreaterThan(40);
    expect(lineMask({ x: 0, y: 0 }, { x: 0, y: 0 })).toBeNull();
  });
});

describe('retouching', () => {
  it('removes red eye', () => {
    const r = solidRaster(30, 30, [200, 180, 160, 255]);
    for (let y = 10; y < 20; y++)
      for (let x = 10; x < 20; x++) setPixel(r, x, y, [220, 30, 30, 255]);
    const n = removeRedEye(r, 15, 15, { radius: 20 });
    expect(n).toBeGreaterThan(50);
    expect(pixelAt(r, 15, 15)[0]).toBeLessThan(100);
    expect(pixelAt(r, 2, 2)).toEqual([200, 180, 160, 255]);
    expect(removeRedEye(solidRaster(5, 5, [10, 10, 10, 255]), 2, 2)).toBe(0);
  });

  it('heals: the copy takes the surrounding tone', () => {
    const dest = solidRaster(40, 40, [200, 200, 200, 255]);
    const copy = solidRaster(40, 40, [50, 50, 50, 255]);
    // Texture on the copy.
    for (let y = 0; y < 40; y += 4)
      for (let x = 0; x < 40; x++) setPixel(copy, x, y, [80, 80, 80, 255]);
    const mask = new Uint8Array(40 * 40);
    for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) mask[y * 40 + x] = 255;
    const out = poissonBlend(dest, copy, mask);
    const centre = pixelAt(out, 20, 21)[0];
    expect(centre).toBeGreaterThan(170);
    expect(Math.abs(pixelAt(out, 20, 20)[0] - pixelAt(out, 20, 21)[0])).toBeGreaterThan(10);
    expect(pixelAt(out, 2, 2)[0]).toBe(200);
    const big = poissonBlend(
      solidRaster(80, 80, [100, 0, 0, 255]),
      solidRaster(80, 80, [0, 0, 0, 255]),
      new Uint8Array(80 * 80).fill(255),
    );
    expect(pixelAt(big, 40, 40)[0]).toBeGreaterThan(90);
  });

  it('fills a hole from its surroundings', () => {
    const r: Raster = createRaster(64, 64);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++)
        setPixel(
          r,
          x,
          y,
          (Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? [220, 220, 220, 255] : [30, 30, 30, 255],
        );
    const hole = new Uint8Array(64 * 64);
    for (let y = 24; y < 40; y++)
      for (let x = 24; x < 40; x++) {
        hole[y * 64 + x] = 1;
        setPixel(r, x, y, [255, 0, 0, 255]);
      }
    const out = contentAwareFill(r, hole, { seed: 3 });
    let red = 0;
    let extremes = 0;
    for (let y = 24; y < 40; y++)
      for (let x = 24; x < 40; x++) {
        const [pr, pg] = pixelAt(out, x, y);
        if (pr > 200 && pg < 80) red++;
        if (pr < 80 || pr > 180) extremes++;
      }
    expect(red).toBe(0);
    // A checkerboard continued is mostly dark or light, not mid grey.
    expect(extremes).toBeGreaterThan(256 * 0.5);
    expect(pixelAt(out, 0, 0)).toEqual(pixelAt(r, 0, 0));
    const tiny = contentAwareFill(solidRaster(4, 4, [1, 2, 3, 255]), new Uint8Array(16).fill(1));
    expect(tiny.width).toBe(4);
  });
});
