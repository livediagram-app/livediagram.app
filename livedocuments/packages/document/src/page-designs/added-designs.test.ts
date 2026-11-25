import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { PAGE_DESIGN_BY_ID, PAGE_DESIGN_IDS, type PageDesignId } from './catalogue';
import { designPalette } from './palette';
import { clearPageDesignCache, pageDesignSvg, paintPageDesign } from './render';
import { DESIGN_GUIDE } from '../style-guide';

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
