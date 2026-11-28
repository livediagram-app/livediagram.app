import { describe, expect, it } from 'vitest';
import {
  BLADE_STRIDE,
  EDGE_FADE,
  FLOWER_STRIDE,
  grassField,
  grassKey,
  MAX_BLADES,
  MAX_FLOWERS,
  onLawn,
} from './scene-grass';

const lawn = (over: Record<string, unknown> = {}) =>
  ({
    id: 'lawn',
    type: 'shape',
    shape: 'grass',
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    ...over,
  }) as never;
const piece = (shape: string, x: number, y: number, w: number, h: number) =>
  ({ id: shape, type: 'shape', shape, x, y, width: w, height: h }) as never;

const at = (f: ReturnType<typeof grassField>, i: number) => ({
  x: f.blades[i * BLADE_STRIDE]!,
  y: f.blades[i * BLADE_STRIDE + 1]!,
  h: f.blades[i * BLADE_STRIDE + 3]!,
  bend: f.blades[i * BLADE_STRIDE + 5]!,
});
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

describe('grassField', () => {
  it('fills a lawn densely, every blade inside it', () => {
    const f = grassField([lawn()]);
    expect(f.count).toBeGreaterThan((400 * 300) / 12);
    for (let i = 0; i < f.count; i++) {
      const b = at(f, i);
      expect(b.x).toBeGreaterThan(0);
      expect(b.x).toBeLessThan(400);
      expect(b.y).toBeGreaterThan(0);
      expect(b.y).toBeLessThan(300);
      expect(b.h).toBeGreaterThan(1.5);
      expect(b.h).toBeLessThan(12);
    }
  });

  it('grows the same blades every time', () => {
    expect(grassField([lawn()]).blades).toEqual(grassField([lawn()]).blades);
  });

  it('never stands in rows (the old view drew level rows of posts)', () => {
    const f = grassField([lawn()]);
    const ys = new Set<number>();
    for (let i = 0; i < f.count; i++) ys.add(Math.round(at(f, i).y));
    // Blades at nearly every px of height, not a handful of row lines.
    expect(ys.size).toBeGreaterThan(250);
  });

  it('grows nothing through a path, a room or floor text', () => {
    const f = grassField([
      lawn(),
      piece('garden-path', 100, 100, 80, 40),
      piece('room', 250, 20, 100, 80),
      { id: 't', type: 'text', x: 20, y: 200, width: 120, height: 30 } as never,
    ]);
    for (let i = 0; i < f.count; i++) {
      const { x, y } = at(f, i);
      // The path's straight middle (its ends are rounded, office-garden.ts gardenPathParts).
      expect(x >= 120 && x <= 160 && y >= 100 && y <= 140).toBe(false);
      expect(x >= 250 && x <= 350 && y >= 20 && y <= 100).toBe(false);
      expect(x >= 20 && x <= 140 && y >= 200 && y <= 230).toBe(false);
    }
  });

  it('keeps a huge scene within its blade budget', () => {
    const f = grassField([lawn({ width: 9000, height: 6000 })]);
    expect(f.count).toBeLessThanOrEqual(MAX_BLADES * 1.1);
    expect(f.count).toBeGreaterThan(MAX_BLADES * 0.6);
  });

  it('has nothing to grow without a lawn', () => {
    const f = grassField([piece('room', 0, 0, 100, 100)]);
    expect(f.count).toBe(0);
    expect(f.flowerCount).toBe(0);
  });

  it('gives each blade its own bend, some nearly upright, some bowed over', () => {
    const f = grassField([lawn()]);
    const bends = Array.from({ length: f.count }, (_, i) => at(f, i).bend);
    expect(Math.min(...bends)).toBeGreaterThanOrEqual(0.4);
    expect(Math.max(...bends)).toBeLessThanOrEqual(1.6);
    expect(Math.max(...bends) - Math.min(...bends)).toBeGreaterThan(0.8);
  });

  it('colours the blades as the floor is drawn on either paper', () => {
    const green = (f: ReturnType<typeof grassField>) =>
      mean(Array.from({ length: f.count }, (_, i) => f.colours[i * 3 + 1]!));
    const light = green(grassField([lawn()], 'light'));
    const dark = green(grassField([lawn()], 'dark'));
    // GRASS_FILL #9bd27a (green 0.82) and GRASS_FILL_DARK #2f4a2c (green 0.29), give or take each blade's shade.
    expect(light).toBeGreaterThan(0.72);
    expect(dark).toBeLessThan(0.36);
    expect(dark).toBeGreaterThan(0.2);
  });

  it('grows shorter where the lawn meets a path, so it thins softly into it', () => {
    const f = grassField([lawn(), piece('garden-path', 180, 0, 40, 300)]);
    const near: number[] = [];
    const far: number[] = [];
    for (let i = 0; i < f.count; i++) {
      const b = at(f, i);
      if (b.y < 40 || b.y > 260) continue;
      const d = Math.min(Math.abs(b.x - 180), Math.abs(b.x - 220));
      if (d < 2) near.push(b.h);
      else if (d > EDGE_FADE + 4 && d < 60) far.push(b.h);
    }
    expect(near.length).toBeGreaterThan(20);
    expect(mean(near)).toBeLessThan(mean(far) * 0.75);
  });

  it('now and then grows a darker, taller tuft', () => {
    const f = grassField([lawn({ width: 800, height: 600 })]);
    const greens = Array.from({ length: f.count }, (_, i) => f.colours[i * 3 + 1]!);
    const typical = mean(greens);
    const deep = greens.filter((g) => g < typical * 0.88).length;
    expect(deep / f.count).toBeGreaterThan(0.01);
    expect(deep / f.count).toBeLessThan(0.15);
  });

  it('grows a few wild flowers in drifts, never through a path, the same every time', () => {
    const els = [lawn({ width: 1600, height: 1200 }), piece('garden-path', 600, 0, 120, 1200)];
    const f = grassField(els);
    expect(f.flowerCount).toBeGreaterThan(0);
    expect(f.flowerCount).toBeLessThan(f.count / 50);
    for (let i = 0; i < f.flowerCount; i++) {
      const x = f.flowers[i * FLOWER_STRIDE]!;
      const y = f.flowers[i * FLOWER_STRIDE + 1]!;
      expect(x >= 600 && x <= 720 && y >= 60 && y <= 1140).toBe(false);
    }
    expect(grassField(els).flowers).toEqual(f.flowers);
  });

  it('keeps the flowers within their budget on a huge lawn', () => {
    const f = grassField([lawn({ width: 9000, height: 6000 })]);
    expect(f.flowerCount).toBeLessThanOrEqual(MAX_FLOWERS);
  });

  it('grows a huge lawn within a time budget', () => {
    const els = [lawn({ width: 9000, height: 6000 }), piece('garden-path', 1000, 0, 200, 6000)];
    grassField(els);
    const t = performance.now();
    grassField(els);
    // About 40 ms on a laptop; generous for a loaded CI runner.
    expect(performance.now() - t).toBeLessThan(600);
  });
});

describe('grassKey', () => {
  it('changes when a lawn or a cover moves, not when a chair does', () => {
    const base = grassKey([lawn(), piece('chair', 10, 10, 20, 20)]);
    expect(grassKey([lawn(), piece('chair', 50, 10, 20, 20)])).toBe(base);
    expect(grassKey([lawn({ x: 5 }), piece('chair', 10, 10, 20, 20)])).not.toBe(base);
    expect(grassKey([lawn(), piece('rug', 10, 10, 20, 20)])).not.toBe(base);
  });
});

describe('onLawn', () => {
  it('is true on a lawn, false off it and where a path covers it', () => {
    const els = [lawn(), piece('garden-path', 100, 100, 50, 50)];
    expect(onLawn(els, 20, 20)).toBe(true);
    expect(onLawn(els, 120, 120)).toBe(false);
    expect(onLawn(els, 500, 20)).toBe(false);
  });
});

describe('grass round a Pond', () => {
  it('grows up to its oval, not only outside its box', async () => {
    const { grassField } = await import('./scene-grass');
    const lawn = { id: 'g', type: 'shape', shape: 'grass', x: 0, y: 0, width: 400, height: 400 };
    const pond = { id: 'p', type: 'shape', shape: 'pond', x: 100, y: 100, width: 200, height: 200 };
    const f = grassField([lawn, pond] as never);
    let corner = 0;
    let water = 0;
    for (let i = 0; i < f.count; i++) {
      const x = f.blades[i * BLADE_STRIDE]!;
      const y = f.blades[i * BLADE_STRIDE + 1]!;
      const u = (x - 200) / 100;
      const v = (y - 200) / 100;
      if (u * u + v * v <= 1) water++;
      else if (x > 100 && x < 130 && y > 100 && y < 130) corner++;
    }
    expect(water).toBe(0);
    expect(corner).toBeGreaterThan(0);
  });
});

describe('grass round a round plaza and the Avatar Pad', () => {
  // The owner's City Park showed a bare square round its round plaza and round the pad: each clears its own outline.
  it.each([
    ['garden-path', 'plaza'],
    ['avatar-pad', 'pad'],
  ])('grows up to the %s circle, not only outside its box', async (shape) => {
    const { grassField, onLawn } = await import('./scene-grass');
    const lawn = { id: 'g', type: 'shape', shape: 'grass', x: 0, y: 0, width: 400, height: 400 };
    const cover = { id: 'c', type: 'shape', shape, x: 100, y: 100, width: 200, height: 200 };
    const f = grassField([lawn, cover] as never);
    let corner = 0;
    let inside = 0;
    for (let i = 0; i < f.count; i++) {
      const x = f.blades[i * BLADE_STRIDE]!;
      const y = f.blades[i * BLADE_STRIDE + 1]!;
      const u = (x - 200) / 100;
      const v = (y - 200) / 100;
      if (u * u + v * v <= 1) inside++;
      else if (x > 100 && x < 130 && y > 100 && y < 130) corner++;
    }
    expect(inside).toBe(0);
    expect(corner).toBeGreaterThan(0);
    expect(onLawn([lawn, cover] as never, 105, 105)).toBe(true);
    expect(onLawn([lawn, cover] as never, 200, 200)).toBe(false);
  });

  it('keeps a long path clear to its rounded ends', async () => {
    const { onLawn } = await import('./scene-grass');
    const lawn = { id: 'g', type: 'shape', shape: 'grass', x: 0, y: 0, width: 400, height: 400 };
    const path = {
      id: 'p',
      type: 'shape',
      shape: 'garden-path',
      x: 0,
      y: 100,
      width: 300,
      height: 40,
    };
    expect(onLawn([lawn, path] as never, 150, 120)).toBe(false);
    // The box's corner, outside the rounded end.
    expect(onLawn([lawn, path] as never, 299, 101)).toBe(true);
  });
});
