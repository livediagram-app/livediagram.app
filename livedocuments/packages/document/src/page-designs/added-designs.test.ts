import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { PAGE_DESIGN_BY_ID, PAGE_DESIGN_IDS, type PageDesignId } from './catalogue';
import { designPalette } from './palette';
import { clearPageDesignCache, pageDesignSvg, paintPageDesign } from './render';
import { DESIGN_GUIDE } from '../style-guide';
import { designGuard } from './guard';

// docs/specs/011-theme/page-designs.md "The twelve added on 2026-11-25": each new design, what it varies (or null).
const ADDED: readonly [PageDesignId, PageDesignId | null][] = [
  ['riso-overprint', 'risograph'],
  ['riso-fade', 'risograph'],
  ['riso-lines', 'risograph'],
  ['blob-echo', 'blobs'],
  ['lava-lamp', 'blobs'],
  ['card-cascade', 'layered-cards'],
  ['polaroids', 'layered-cards'],
  ['moire', null],
  ['terrazzo', null],
  ['bauhaus', null],
  ['brush-strokes', null],
  ['sunburst', null],
];

const COLOURS: [string, string, string] = ['#e11d48', '#2563eb', '#f59e0b'];
const light = designPalette({}, {}, false, COLOURS);
const dark = designPalette({}, {}, true, COLOURS);
const SIZES: [number, number][] = [
  [1920, 1080],
  [794, 1123],
  [390, 844],
];

const markup = (id: PageDesignId, palette = light, w = 1920, h = 1080, variant?: string) =>
  paintPageDesign({
    design: { id, ...(variant ? { variant } : {}) },
    palette,
    width: w,
    height: h,
  })
    .layers.map((l) => l.svg)
    .join('');

describe('the twelve page designs added on 2026-11-25', () => {
  it('are twelve, each in the catalogue, the style guide and the family of the design it varies, right after it', () => {
    expect(ADDED).toHaveLength(12);
    expect(ADDED.filter(([, of]) => of)).toHaveLength(7);
    for (const [id, of] of ADDED) {
      expect(PAGE_DESIGN_BY_ID[id], id).toBeDefined();
      expect(DESIGN_GUIDE[id]?.use.length, id).toBeGreaterThan(10);
      if (!of) continue;
      expect(PAGE_DESIGN_BY_ID[id].family).toBe(PAGE_DESIGN_BY_ID[of].family);
      // Between the original and this one sit only its other variations.
      const between = PAGE_DESIGN_IDS.slice(
        PAGE_DESIGN_IDS.indexOf(of) + 1,
        PAGE_DESIGN_IDS.indexOf(id),
      );
      for (const other of between) expect(ADDED.find(([a]) => a === other)?.[1], other).toBe(of);
    }
  });

  it('draw in every style, at a slide, an article and a phone size, light and dark, with no stray values', () => {
    for (const [id] of ADDED)
      for (const variant of PAGE_DESIGN_BY_ID[id].variants?.map((v) => v.id) ?? [undefined])
        for (const [w, h] of SIZES)
          for (const palette of [light, dark]) {
            const svg = markup(id, palette, w, h, variant);
            expect(svg.length, `${id} ${variant} ${w}x${h}`).toBeGreaterThan(100);
            expect(svg).not.toMatch(/NaN|undefined|Infinity/);
          }
  });

  it('each look clearly unlike the design it varies, not a recolour', () => {
    for (const [id, of] of ADDED) {
      if (!of) continue;
      const mine = markup(id).replace(/[\d.-]+/g, '#');
      const theirs = markup(of).replace(/[\d.-]+/g, '#');
      expect(mine, id).not.toBe(theirs);
      // Its shapes differ, not only its numbers: the set of elements and attributes it draws.
      const shape = (s: string) =>
        [...new Set(s.match(/<[a-zA-Z]+|[a-z-]+=/g) ?? [])].sort().join();
      const kinds = (s: string) => s.match(/<[a-zA-Z]+/g)?.length ?? 0;
      expect(shape(mine) !== shape(theirs) || kinds(mine) !== kinds(theirs), id).toBe(true);
    }
  });

  it('use a filter only for a still texture grain, and move only by the layers the catalogue says', () => {
    for (const [id] of ADDED) {
      const painted = paintPageDesign({
        design: { id },
        palette: light,
        width: 1920,
        height: 1080,
      });
      for (const layer of painted.layers)
        if (layer.motion) expect(layer.svg, id).not.toContain('<filter');
      const filtered = painted.layers.some((l) => l.svg.includes('<filter'));
      expect(filtered, id).toBe(id.startsWith('riso-'));
      expect(painted.layers.some((l) => l.motion)).toBe(!!PAGE_DESIGN_BY_ID[id].animates);
      // The still frame every export draws.
      expect(pageDesignSvg(painted, { x: 0, y: 0 })).toContain('<g');
    }
  });

  it('each draws cold at 1920 x 1080 within a frame, at any scale', () => {
    // A cold draw of one design, its worst scale (the smallest, the most parts), under 16 ms; x10 for CI.
    for (const [id] of ADDED) {
      const draw = () => {
        clearPageDesignCache();
        for (const scale of [0.5, 1, 2])
          paintPageDesign({
            design: { id, scale, seed: 4321 },
            palette: dark,
            width: 1920,
            height: 1080,
          });
      };
      draw();
      let best = Infinity;
      for (let r = 0; r < 3; r += 1) best = Math.min(best, cpuMsOf(draw));
      expect(best / 3, id).toBeLessThan(cpuBudgetMs(16));
    }
  });
});

const textAt = (id: string, x: number, y: number, width = 300, height = 50) =>
  ({ id, type: 'text', x, y, width, height, label: 'Relay', textColor: '#ffffff' }) as never;

// How far a part reaches into the page from its nearest edge, as a share of the page's short side.
const inset = (p: { x: number; y: number; w: number; h: number }, w: number, h: number) =>
  Math.min(Math.min(p.x + p.w, w) - Math.max(p.x, 0), Math.min(p.y + p.h, h) - Math.max(p.y, 0)) /
  Math.min(w, h);

describe('the contrast guard sees a design’s solid parts (plates)', () => {
  const rect = { x: 0, y: 0, width: 1920, height: 1080 };
  const polaroids = paintPageDesign({
    design: { id: 'polaroids' },
    palette: dark,
    width: 1920,
    height: 1080,
  });
  // A slide's title and author line at the usual margins.
  const words = [textAt('title', 160, 120), textAt('author', 160, 900)];

  it('fails white text on the first Polaroids’ opaque frame, which the average alone missed', () => {
    // The first Polaroids: a 20 x 24 unit frame centred at 8% and 10% of the page, under a slide's title.
    const u = 10.8 * 1.1;
    const frame = { x: 0.08 * 1920 - 10 * u, y: 0.1 * 1080 - 12 * u, w: 20 * u, h: 24 * u };
    const title = textAt('title', 100, 80);
    const averageOnly = designGuard({ ...polaroids, layers: [{ svg: '' }] }, rect, [title]);
    expect(averageOnly.failing).toEqual([]);
    const withPlate = designGuard(
      {
        ...polaroids,
        layers: [{ svg: '', plates: [{ ...frame, colours: ['#f1f5f9'], opacity: 1 }] }],
      },
      rect,
      [title],
    );
    expect(withPlate.failing).toEqual(['title']);
  });

  it('keeps Polaroids and every Bauhaus style to the margins, so a layout’s words pass', () => {
    const frames = polaroids.layers.flatMap((l) => l.plates ?? []);
    expect(frames).toHaveLength(4);
    for (const p of frames) expect(inset(p, 1920, 1080)).toBeLessThan(0.16);
    expect(designGuard(polaroids, rect, words).failing).toEqual([]);
    for (const variant of ['bottom', 'left', 'corner']) {
      const bauhaus = paintPageDesign({
        design: { id: 'bauhaus', variant },
        palette: dark,
        width: 1920,
        height: 1080,
      });
      const tiles = bauhaus.layers.flatMap((l) => l.plates ?? []);
      expect(tiles.length, variant).toBeGreaterThan(3);
      for (const t of tiles) expect(inset(t, 1920, 1080), variant).toBeLessThan(0.06);
      expect(designGuard(bauhaus, rect, words).failing, variant).toEqual([]);
    }
  });

  it('fails and scrims a text laid over a plate that still meets it', () => {
    const out = designGuard(polaroids, rect, [textAt('corner', 0, 0, 200, 60)]);
    expect(out.failing).toEqual(['corner']);
    expect(out.scrims).toHaveLength(1);
  });
});
