import { describe, expect, it } from 'vitest';
import { combineMasks, createMask, maskAt, maskBounds, selectedCount } from '../raster/mask';
import { createRaster, setPixel, solidRaster, type Raster } from '../raster/raster';
import { distanceTransform } from './distance';
import { antiAliasEdge, colourRange, floodSelect } from './flood';
import { grabCut, selectSubject, subjectTrimap, TRIMAP } from './grabcut';
import { fitGmm, negLogLikelihood, bestComponent } from './gmm';
import { edgeCost, livewirePath } from './livewire';
import { GridGraph } from './maxflow';
import { borderMask, contractMask, expandMask, featherMask, smoothMask } from './modify';
import { maskOutline } from './outline';
import { quickSelect, refineEdge } from './quick-select';
import { ellipseMask, polygonMask, rectMask } from './shapes';

/** A w x h picture: `inside` colour in the box, `outside` elsewhere. */
function boxPicture(
  w: number,
  h: number,
  box: [number, number, number, number],
  inside: number[],
  outside: number[],
): Raster {
  const r = solidRaster(w, h, outside);
  for (let y = box[1]; y < box[3]; y++)
    for (let x = box[0]; x < box[2]; x++) setPixel(r, x, y, inside);
  return r;
}

describe('shape selections', () => {
  it('rectangles cover fractional edges in part', () => {
    const m = rectMask(0.5, 0, 2, 1)!;
    expect([...m.data]).toEqual([128, 255]);
    const hard = rectMask(3, 3, 0.4, 0.4, false)!;
    expect(hard).toMatchObject({ x: 0, y: 0, width: 3, height: 3 });
    expect(rectMask(0, 0, 0, 5)).toBeNull();
    expect(rectMask(0, 0, 0.2, 0, false)).toBeNull();
  });
  it('ellipses are round and anti-aliased', () => {
    const m = ellipseMask(0, 0, 10, 10)!;
    expect(maskAt(m, 5, 5)).toBe(255);
    expect(maskAt(m, 0, 0)).toBe(0);
    const edge = maskAt(m, 1, 2);
    expect(edge).toBeGreaterThan(0);
    const hard = ellipseMask(0, 0, 10, 10, false)!;
    expect(new Set(hard.data).size).toBe(2);
    expect(ellipseMask(0, 0, 0, 10)).toBeNull();
  });
  it('polygons fill by even-odd', () => {
    const tri = polygonMask([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ])!;
    expect(maskAt(tri, 1, 1)).toBe(255);
    expect(maskAt(tri, 9, 9)).toBe(0);
    expect(
      polygonMask([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBeNull();
    const square = polygonMask(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
      false,
    )!;
    expect(selectedCount(square)).toBe(16);
    expect(
      polygonMask([
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ]),
    ).toBeNull();
  });
});

describe('colour selections', () => {
  const pic = boxPicture(10, 10, [2, 2, 5, 5], [255, 0, 0, 255], [0, 0, 255, 255]);
  it('magic wand, contiguous or not', () => {
    const m = floodSelect(pic, 3, 3);
    expect(selectedCount(m)).toBe(9);
    expect(maskBounds(m)).toEqual({ x: 2, y: 2, width: 3, height: 3 });
    const twoBoxes = boxPicture(10, 10, [0, 0, 2, 2], [255, 0, 0, 255], [0, 0, 255, 255]);
    setPixel(twoBoxes, 9, 9, [255, 0, 0, 255]);
    expect(selectedCount(floodSelect(twoBoxes, 0, 0))).toBe(4);
    expect(selectedCount(floodSelect(twoBoxes, 0, 0, { contiguous: false }))).toBe(5);
    expect(selectedCount(floodSelect(pic, 50, 50))).toBe(0);
    expect(selectedCount(floodSelect(pic, 0, 0, { tolerance: 255 }))).toBe(100);
    const at = floodSelect(pic, 3, 3, { at: { x: 100, y: 100 } });
    expect(maskAt(at, 103, 103)).toBe(255);
  });
  it('anti-aliases a hard edge', () => {
    const soft = antiAliasEdge(floodSelect(pic, 3, 3));
    expect(maskAt(soft, 2, 2)).toBeGreaterThan(0);
    expect(maskAt(soft, 2, 2)).toBeLessThan(255);
    expect(maskAt(soft, 3, 3)).toBe(255);
  });
  it('colour range by fuzziness', () => {
    const m = colourRange(pic, [[255, 0, 0]], 40);
    expect(maskAt(m, 3, 3)).toBe(255);
    expect(maskAt(m, 0, 0)).toBe(0);
    expect(selectedCount(colourRange(pic, [], 40))).toBe(0);
    const near = colourRange(solidRaster(1, 1, [235, 0, 0, 255]), [[255, 0, 0]], 40);
    expect(near.data[0]).toBe(128);
    const clear = colourRange(createRaster(1, 1), [[0, 0, 0]], 40);
    expect(clear.data[0]).toBe(0);
  });
});

describe('modifying selections', () => {
  const sq = () => rectMask(10, 10, 20, 20, false)!;
  it('expands, contracts and borders', () => {
    const e = expandMask(sq(), 2)!;
    expect(maskBounds(e)).toEqual({ x: 8, y: 8, width: 14, height: 14 });
    const c = contractMask(sq(), 2)!;
    expect(maskBounds(c)).toEqual({ x: 12, y: 12, width: 6, height: 6 });
    expect(contractMask(sq(), 20)).toBeNull();
    const b = borderMask(sq(), 4)!;
    expect(maskAt(b, 15, 15)).toBe(0);
    expect(maskAt(b, 10, 15)).toBe(255);
    expect(expandMask(sq(), 0)).toEqual(sq());
    expect(contractMask(sq(), 0)).toEqual(sq());
    expect(borderMask(rectMask(0, 0, 2, 2, false)!, 10)).not.toBeNull();
  });
  it('feathers and smooths', () => {
    const f = featherMask(sq(), 2)!;
    expect(maskAt(f, 15, 15)).toBeGreaterThan(240);
    expect(maskAt(f, 10, 15)).toBeGreaterThan(80);
    expect(maskAt(f, 10, 15)).toBeLessThan(200);
    expect(maskAt(f, 7, 15)).toBeGreaterThan(0);
    expect(featherMask(sq(), 0)).toEqual(sq());
    const s = smoothMask(sq(), 4)!;
    expect(maskAt(s, 15, 15)).toBe(255);
    expect(maskAt(s, 10, 10)).toBe(0);
    expect(smoothMask(sq(), 0)).toEqual(sq());
  });
  it('traces the edge as loops', () => {
    const loops = maskOutline(sq());
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(4);
    const ring = borderMask(rectMask(0, 0, 20, 20, false)!, 4)!;
    expect(maskOutline(ring)).toHaveLength(2);
    expect(maskOutline(createMask({ x: 0, y: 0, width: 3, height: 3 }))).toEqual([]);
  });
  it('distance transform', () => {
    const d = distanceTransform(5, 1, (i) => i === 0);
    expect([...d]).toEqual([0, 1, 2, 3, 4]);
    const diag = distanceTransform(3, 3, (i) => i === 0);
    expect(diag[8]).toBeCloseTo(Math.SQRT2 * 2);
  });
});

describe('max-flow', () => {
  it('cuts the cheapest edge of a chain', () => {
    const g = new GridGraph(3, 1);
    g.setTerminal(0, 10, 0);
    g.setTerminal(2, 0, 10);
    g.setEdge(0, 0, 5, 5);
    g.setEdge(1, 0, 1, 1);
    const { side, flow } = g.solve();
    expect([...side]).toEqual([1, 1, 0]);
    expect(flow).toBe(1);
  });
  it('splits a grid by its terminals', () => {
    const w = 8;
    const g = new GridGraph(w, w);
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (x === 0) g.setTerminal(i, 100, 0);
        if (x === w - 1) g.setTerminal(i, 0, 100);
        for (let d = 0; d < 4; d++)
          g.setEdge(i, d, x === 3 && d === 0 ? 0.1 : 5, x === 3 && d === 0 ? 0.1 : 5);
      }
    const { side } = g.solve();
    for (let y = 0; y < w; y++) {
      expect(side[y * w]).toBe(1);
      expect(side[y * w + w - 1]).toBe(0);
    }
  });
});

describe('GrabCut', () => {
  it('fits colour models', () => {
    const s = new Float32Array([255, 0, 0, 250, 5, 0, 0, 0, 255, 5, 0, 250]);
    const gmm = fitGmm(s, 2);
    expect(gmm).toHaveLength(2);
    expect(negLogLikelihood(gmm, 252, 2, 0)).toBeLessThan(negLogLikelihood(gmm, 0, 255, 0));
    expect(bestComponent(gmm, 255, 0, 0)).not.toBe(bestComponent(gmm, 0, 0, 255));
    expect(fitGmm(new Float32Array(0))).toEqual([]);
  });
  it('finds a subject on a plain background', () => {
    const pic = boxPicture(40, 40, [12, 12, 28, 28], [220, 40, 40, 255], [40, 60, 200, 255]);
    // A little noise so the models have spread.
    for (let i = 0; i < pic.data.length; i += 4) pic.data[i]! += (i * 7919) % 11;
    const m = selectSubject(pic, 3);
    expect(m[20 * 40 + 20]).toBe(255);
    expect(m[2 * 40 + 2]).toBe(0);
    let wrong = 0;
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < 40; x++) {
        const inBox = x >= 12 && x < 28 && y >= 12 && y < 28;
        if ((m[y * 40 + x] === 255) !== inBox) wrong++;
      }
    expect(wrong).toBeLessThan(40);
  });
  it('falls back to the trimap when one side has no pixels', () => {
    const t = new Uint8Array(4).fill(TRIMAP.foreground);
    expect([...grabCut(solidRaster(2, 2, [1, 2, 3, 255]), t)]).toEqual([255, 255, 255, 255]);
    expect(subjectTrimap(100, 100)[0]).toBe(TRIMAP.background);
  });
});

describe('quick select and refine', () => {
  it('grows a stroke to the region edge', () => {
    const pic = boxPicture(60, 60, [10, 10, 40, 40], [230, 200, 30, 255], [20, 120, 60, 255]);
    for (let i = 0; i < pic.data.length; i += 4) pic.data[i + 1]! += (i * 104729) % 9;
    const stroke = rectMask(22, 22, 26, 26, false)!;
    const m = quickSelect(pic, null, stroke);
    expect(maskAt(m, 12, 12)).toBe(255);
    expect(maskAt(m, 38, 38)).toBe(255);
    expect(maskAt(m, 45, 45)).toBe(0);
    const less = quickSelect(pic, m, rectMask(12, 12, 16, 16, false)!, { subtract: true });
    expect(maskAt(less, 13, 13)).toBe(0);
    expect(quickSelect(pic, null, rectMask(-50, -50, -40, -40, false)!)).toBeDefined();
  });
  it('leaves look-alike areas the stroke does not reach unselected', () => {
    // Two yellow boxes on green, both inside the cut's window; the stroke is in the left one only.
    const pic = boxPicture(90, 50, [5, 10, 25, 35], [230, 200, 30, 255], [20, 120, 60, 255]);
    for (let y = 10; y < 35; y++)
      for (let x = 35; x < 50; x++) setPixel(pic, x, y, [230, 200, 30, 255]);
    const stroke = rectMask(9, 16, 21, 28, false)!;
    const m = quickSelect(pic, null, stroke);
    expect(maskAt(m, 7, 12)).toBe(255);
    expect(maskAt(m, 42, 20)).toBe(0);
    // Taking away from both: only the brushed box goes.
    const both = combineMasks(
      rectMask(5, 10, 25, 35, false),
      rectMask(35, 10, 50, 35, false)!,
      'add',
    )!;
    const less = quickSelect(pic, both, stroke, { subtract: true });
    expect(maskAt(less, 7, 12)).toBe(0);
    expect(maskAt(less, 42, 20)).toBe(255);
  });
  it('refines a soft edge by colour', () => {
    const pic = solidRaster(30, 10, [0, 0, 0, 255]);
    for (let x = 15; x < 30; x++)
      for (let y = 0; y < 10; y++) setPixel(pic, x, y, [255, 255, 255, 255]);
    // A half-way column.
    for (let y = 0; y < 10; y++) setPixel(pic, 15, y, [128, 128, 128, 255]);
    const hard = rectMask(15, 0, 30, 10, false)!;
    const refined = refineEdge(pic, hard, 3);
    expect(Math.abs(maskAt(refined, 15, 5) - 128)).toBeLessThan(10);
    expect(maskAt(refined, 25, 5)).toBe(255);
  });
});

describe('magnetic lasso', () => {
  it('follows a strong edge', () => {
    const pic = boxPicture(40, 40, [0, 0, 20, 40], [255, 255, 255, 255], [0, 0, 0, 255]);
    const cost = edgeCost(pic);
    const path = livewirePath(cost, { x: 19, y: 2 }, { x: 19, y: 37 }, 10);
    expect(path[0]).toEqual({ x: 19, y: 2 });
    expect(path.at(-1)).toEqual({ x: 19, y: 37 });
    for (const p of path) expect(Math.abs(p.x - 19.5)).toBeLessThanOrEqual(1.5);
    const flat = livewirePath(
      edgeCost(solidRaster(5, 5, [1, 1, 1, 255])),
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    );
    expect(flat).toHaveLength(5);
  });
});
