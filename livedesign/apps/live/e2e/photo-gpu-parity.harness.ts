// The GPU compositor against the CPU composite (docs/specs/031-photo/blueprints/photo-engine.md "The GPU
// compositor"), in a browser: each scenario drawn by both and compared pixel by pixel over white. Bundled
// and run by photo-gpu-parity.spec.ts. Its photos are patterned so every row and column differs: a flip,
// a shift or a pass that draws nothing shows.
import {
  ADJUSTMENTS,
  BLEND_MODES,
  compositeAll,
  compositePhoto,
  createRaster,
  LAYER_ADJUSTMENT_IDS,
  TiledRaster,
  type AdjustmentId,
  type PhotoLayer,
  type PixelsLookup,
  type Raster,
} from '@livedesign/photo-engine';
import { GlCompositor, type ViewRect } from '../lib/photo-editor/gl/gl-compositor';

const W = 64;
const H = 48;
// Over this many levels apart, a channel counts as wrong.
const LEVELS = 6;

export type ParityResult = { name: string; max: number; bad: number; glError: number };
type Scenario = {
  name: string;
  layers: PhotoLayer[];
  rasters: Record<string, Raster>;
  masks?: Record<string, Uint8Array>;
};

// A picture whose every row and column differs.
function pattern(seed: number): Raster {
  const r = createRaster(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      r.data[i] = (x * 4 + seed * 37) & 255;
      r.data[i + 1] = (y * 5 + seed * 11) & 255;
      r.data[i + 2] = ((x + y) * 3 + seed * 53) & 255;
      r.data[i + 3] = 255;
    }
  return r;
}

// The pattern with a transparent corner and half-transparent dots.
function partly(seed: number): Raster {
  const r = pattern(seed);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (x + y * 1.3 > 50) r.data[(y * W + x) * 4 + 3] = 0;
      if ((x + y) % 7 === 0) r.data[(y * W + x) * 4 + 3] = 128;
    }
  return r;
}

const px = (id: string, more: Partial<PhotoLayer> = {}): PhotoLayer =>
  ({ id, name: id, layerKind: 'pixel', pixels: { tiles: {} }, ...more }) as PhotoLayer;
const group = (id: string, more: Partial<PhotoLayer> = {}): PhotoLayer =>
  ({ id, name: id, layerKind: 'group', ...more }) as PhotoLayer;
const adjustment = (
  id: string,
  adjust: AdjustmentId,
  params: Record<string, unknown>,
  more: Partial<PhotoLayer> = {},
): PhotoLayer =>
  ({
    id,
    name: id,
    layerKind: 'adjustment',
    adjustment: { id: adjust, params },
    ...more,
  }) as PhotoLayer;
const masked = { mask: { pixels: { tiles: {} } } } as Partial<PhotoLayer>;

function lookupOf(
  rasters: Record<string, Raster>,
  masks: Record<string, Uint8Array> = {},
): PixelsLookup {
  const layers = new Map(Object.entries(rasters).map(([k, v]) => [k, TiledRaster.fromRaster(v)]));
  const maskRasters = new Map(
    Object.entries(masks).map(([k, grey]) => {
      const m = new TiledRaster(1, 255);
      m.writeChannel({ x: 0, y: 0, width: W, height: H }, grey);
      return [k, m];
    }),
  );
  return { layer: (id: string) => layers.get(id), mask: (id: string) => maskRasters.get(id) };
}

// White over the top third, grey over the middle, black under it.
function bands(): Uint8Array {
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) g[y * W + x] = y < H / 3 ? 255 : y < (2 * H) / 3 ? 128 : 0;
  return g;
}

// Each adjustment's settings, moved off its defaults so it does something.
const TURNED: Partial<Record<AdjustmentId, (p: Record<string, unknown>) => void>> = {
  brightness: (p) => Object.assign(p, { brightness: 40, contrast: 30 }),
  levels: (p) => {
    p.rgb = { ...(p.rgb as object), inBlack: 30, inWhite: 200, gamma: 1.4 };
  },
  exposure: (p) => Object.assign(p, { exposure: 0.8 }),
  vibrance: (p) => Object.assign(p, { vibrance: 50, saturation: 20 }),
  'hue-saturation': (p) => {
    p.master = { ...(p.master as object), hue: 40, saturation: 30 };
  },
  posterize: (p) => Object.assign(p, { levels: 4 }),
  threshold: (p) => Object.assign(p, { level: 120 }),
  'white-balance': (p) => Object.assign(p, { temperature: 40, tint: -20 }),
  'photo-filter': (p) => Object.assign(p, { density: 0.5 }),
  curves: (p) => {
    p.rgb = [
      [0, 0],
      [100, 160],
      [255, 255],
    ];
  },
};

function scenarios(): Scenario[] {
  const two = { a: pattern(1), b: partly(2) };
  const three = { ...two, c: partly(3) };
  const out: Scenario[] = [
    { name: 'one layer', layers: [px('a')], rasters: { a: pattern(1) } },
    { name: 'two layers', layers: [px('a'), px('b')], rasters: two },
    { name: 'three layers', layers: [px('a'), px('b'), px('c')], rasters: three },
    { name: 'opacity', layers: [px('a'), px('b', { opacity: 0.4 })], rasters: two },
    {
      name: 'mask',
      layers: [px('a'), px('b', masked)],
      rasters: { a: pattern(1), b: pattern(2) },
      masks: { b: bands() },
    },
    { name: 'clip', layers: [px('a'), px('b'), px('c', { clip: true })], rasters: three },
    { name: 'hidden', layers: [px('a'), px('b', { visible: false })], rasters: two },
    {
      name: 'group',
      layers: [
        px('a'),
        group('g', { blend: 'normal', opacity: 0.7 }),
        px('b', { parent: 'g' }),
        px('c', { parent: 'g', blend: 'multiply' }),
      ],
      rasters: three,
    },
    {
      name: 'nested groups',
      layers: [
        px('a'),
        group('g', { blend: 'screen' }),
        group('h', { parent: 'g', opacity: 0.6, blend: 'normal' }),
        px('b', { parent: 'h' }),
        px('c', { parent: 'g', blend: 'overlay' }),
      ],
      rasters: three,
    },
    {
      name: 'pass-through group',
      layers: [
        px('a'),
        group('g'),
        px('b', { parent: 'g', blend: 'multiply' }),
        adjustment('j', 'invert', {}, { parent: 'g' }),
      ],
      rasters: two,
    },
    {
      name: 'masked group',
      layers: [px('a'), group('g', { blend: 'normal', ...masked }), px('b', { parent: 'g' })],
      rasters: { a: pattern(1), b: pattern(2) },
      masks: { g: bands() },
    },
    {
      name: 'clipped adjustment',
      layers: [px('a'), px('b'), adjustment('j', 'invert', {}, { clip: true })],
      rasters: two,
    },
    {
      name: 'offset',
      layers: [px('a'), px('b', { offset: { x: 7, y: -5 } })],
      rasters: two,
    },
    {
      name: 'solid fill',
      layers: [
        px('a'),
        {
          id: 'f',
          name: 'f',
          layerKind: 'fill',
          fill: { kind: 'solid', colour: '#336699' },
          opacity: 0.5,
        },
      ],
      rasters: { a: pattern(1) },
    },
  ];
  for (const mode of BLEND_MODES)
    if (mode !== 'dissolve' && mode !== 'pass-through')
      out.push({
        name: `blend ${mode}`,
        layers: [px('a'), px('b', { blend: mode })],
        rasters: two,
      });
  for (const id of LAYER_ADJUSTMENT_IDS) {
    const params = structuredClone(ADJUSTMENTS[id].defaults);
    TURNED[id]?.(params);
    out.push({
      name: `adjust ${id}`,
      layers: [px('a'), px('b'), adjustment('j', id, params)],
      rasters: two,
    });
    out.push({
      name: `adjust ${id} masked`,
      layers: [px('a'), adjustment('j', id, params, masked)],
      rasters: { a: pattern(1) },
      masks: { j: bands() },
    });
  }
  return out;
}

/** The GPU's frame (bottom-up) against the CPU's rect (top-down), over white, `k` device px a photo px. */
function compare(
  got: Uint8Array,
  w: number,
  h: number,
  cpu: Raster,
  k: number,
): { max: number; bad: number } {
  let max = 0;
  let bad = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ci = (Math.floor(y / k) * cpu.width + Math.floor(x / k)) * 4;
      const gi = ((h - 1 - y) * w + x) * 4;
      const a = cpu.data[ci + 3]! / 255;
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(got[gi + c]! - (cpu.data[ci + c]! * a + 255 * (1 - a)));
        if (d > LEVELS) bad++;
        max = Math.max(max, d);
      }
    }
  return { max: Math.round(max), bad };
}

function draw(gl: GlCompositor, s: Scenario, view: ViewRect, w: number, h: number): Uint8Array {
  const photo = { width: W, height: H, layers: s.layers };
  gl.render(photo, lookupOf(s.rasters, s.masks), view, w, h, { checker: 1e6, dark: false });
  const got = new Uint8Array(w * h * 4);
  gl.gl.readPixels(0, 0, w, h, gl.gl.RGBA, gl.gl.UNSIGNED_BYTE, got);
  return got;
}

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  document.body.append(c);
  return c;
}

declare global {
  interface Window {
    hasWebGl2: () => boolean;
    runParity: () => ParityResult[];
    runViews: () => ParityResult[];
  }
}

// Whether this browser has WebGL 2 (a CI machine without a GPU may not): the spec skips without it.
window.hasWebGl2 = () => !!document.createElement('canvas').getContext('webgl2');

window.runParity = () => {
  const gl = new GlCompositor(canvasOf(W, H));
  const whole = { x: 0, y: 0, width: W, height: H };
  return scenarios().map((s) => {
    const cpu = compositeAll(
      { width: W, height: H, layers: s.layers },
      lookupOf(s.rasters, s.masks),
    );
    const got = draw(gl, s, whole, W, H);
    return { name: s.name, ...compare(got, W, H, cpu, 1), glError: gl.gl.getError() };
  });
};

// Part of the photo, drawn 1:1 (a page partly off screen) and zoomed in past hard edges.
window.runViews = () => {
  const s: Scenario = {
    name: 'view',
    layers: [px('a'), px('b'), px('c', { blend: 'multiply' })],
    rasters: { a: pattern(1), b: partly(2), c: partly(3) },
  };
  return [
    { name: 'sub-rect', view: { x: 10, y: 6, width: 30, height: 20 }, w: 30, h: 20 },
    { name: 'zoomed', view: { x: 12, y: 8, width: 16, height: 12 }, w: 64, h: 48 },
  ].map((v) => {
    const gl = new GlCompositor(canvasOf(v.w, v.h));
    const cpu = compositePhoto(
      { width: W, height: H, layers: s.layers },
      lookupOf(s.rasters),
      v.view,
    );
    const got = draw(gl, s, v.view, v.w, v.h);
    return {
      name: v.name,
      ...compare(got, v.w, v.h, cpu, v.w / v.view.width),
      glError: gl.gl.getError(),
    };
  });
};
