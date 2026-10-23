import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@livedesign/vitest-config/cpu-time';
import { sketchBackdropIds } from './sketch-backdrop';
import type { Element } from './index';

// Sketch backdrops (docs/specs/008-canvas/finish.md "Sketch"): a shape something sits on keeps a solid fill.
const shape = (id: string, x: number, y: number, w: number, h: number, over = {}): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: w,
  height: h,
  ...over,
});
const text = (id: string, x: number, y: number): Element => ({
  id,
  type: 'text',
  x,
  y,
  width: 80,
  height: 20,
  label: id,
});

describe('sketchBackdropIds', () => {
  it("marks a key's card that captions sit on, not the shapes standing alone", () => {
    const els = [
      shape('card', 0, 0, 200, 300),
      text('caption', 20, 20),
      shape('lone', 400, 0, 100, 60),
    ];
    expect([...sketchBackdropIds(els, 'sketch')]).toEqual(['card']);
  });

  it('only counts what is drawn above the shape', () => {
    // The caption is under the card in drawing order, so the card covers it rather than backing it.
    const els = [text('caption', 20, 20), shape('card', 0, 0, 200, 300)];
    expect(sketchBackdropIds(els, 'sketch').size).toBe(0);
  });

  it('is empty when nothing is sketched, and follows each element’s own finish', () => {
    const els = [shape('card', 0, 0, 200, 300), text('caption', 20, 20)];
    expect(sketchBackdropIds(els, undefined).size).toBe(0);
    expect(sketchBackdropIds(els, 'professional').size).toBe(0);
    const own = [shape('card', 0, 0, 200, 300, { finish: 'sketch' }), text('caption', 20, 20)];
    expect([...sketchBackdropIds(own, undefined)]).toEqual(['card']);
  });

  it('ignores kinds that never hatch (self-painting faces)', () => {
    const els = [shape('f', 0, 0, 200, 300, { shape: 'bar-chart' }), text('caption', 20, 20)];
    expect(sketchBackdropIds(els, 'sketch').size).toBe(0);
  });

  it('stays fast on a large sketched tab', () => {
    // Worst case for the sweep: 2000 overlapping shapes in a 40 x 50 grid of 120 px cells, each
    // card nudged so its neighbours' centres fall inside it.
    const els: Element[] = [];
    for (let i = 0; i < 2000; i++)
      els.push(shape(`s${i}`, (i % 40) * 100, Math.floor(i / 40) * 100, 160, 160));
    sketchBackdropIds(els, 'sketch');
    // CPU time, not wall time: the parallel suite starves a wall-clock budget (#586).
    const ms = Math.min(
      ...[0, 1, 2, 3, 4].map(() => cpuMsOf(() => void sketchBackdropIds(els, 'sketch'))),
    );
    expect(ms).toBeLessThan(cpuBudgetMs(25));
  });
});
