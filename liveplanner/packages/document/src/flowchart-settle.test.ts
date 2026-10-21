import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveplanner/vitest-config/cpu-time';
import { createPinnedArrow, createShape } from './factories';
import { createFlowchartStart } from './flowchart';
import { addFlowchartLane, applyFlowchartStep, planFlowchartStep } from './flowchart-grow';
import { settleFlowcharts } from './flowchart-settle';
import type { ArrowElement, Element, ShapeElement } from './index';

// docs/specs/009-elements/flowchart.md "The layout", "Swimlanes"; blueprint D171.

let n = 0;
const grow = (els: Element[], from: string, type?: 'decision') => {
  const plan = planFlowchartStep(els, from, 'next', { step: `s${++n}`, connector: `c${n}` }, type)!;
  return { els: applyFlowchartStep(els, plan), id: plan.step.id };
};
const box = (els: readonly Element[], id: string) => els.find((e) => e.id === id) as ShapeElement;

function chart() {
  const start = createFlowchartStart(0, 0);
  const a = grow([start], start.id);
  const b = grow(a.els, a.id);
  return { els: b.els, start: start.id, a: a.id, b: b.id };
}

describe('settleFlowcharts', () => {
  it('leaves a commit that touches no chart alone', () => {
    const els: Element[] = [createShape('square', 0, 0)];
    const after = [...els, createShape('circle', 10, 10)];
    expect(settleFlowcharts(els, after)).toBe(after);
    expect(settleFlowcharts(els, els)).toBe(els);
  });

  it('leaves a drag of a step where it was dropped', () => {
    const c = chart();
    const after = c.els.map((e) => (e.id === c.a ? { ...e, x: 900, y: 900 } : e));
    expect(box(settleFlowcharts(c.els, after), c.a)).toMatchObject({ x: 900, y: 900 });
  });

  it('lays a chart out again when an arrow joins two of its steps', () => {
    const c = chart();
    const after = [...c.els, { ...createPinnedArrow(c.start, 'e', c.b, 'w'), id: 'skip' }];
    const out = settleFlowcharts(c.els, after);
    expect(out).not.toBe(after);
    const skip = out.find((e) => e.id === 'skip') as ArrowElement;
    expect(skip.from).toMatchObject({ anchor: 's' });
  });

  it('lays a chart out again when a step is deleted, closing the gap', () => {
    const c = chart();
    const gone = c.els.filter(
      (e) =>
        e.id !== c.a &&
        !(e.type === 'arrow' && e.to.kind === 'pinned' && e.to.elementId === c.a) &&
        !(e.type === 'arrow' && e.from.kind === 'pinned' && e.from.elementId === c.a),
    );
    const after = [...gone, { ...createPinnedArrow(c.start, 's', c.b, 'n'), id: 'join' }];
    const out = settleFlowcharts(c.els, after);
    expect(box(out, c.b).y).toBe(box(c.els, c.a).y);
  });

  it('labels an exit drawn out of a Decision Yes, then No', () => {
    const start = createFlowchartStart(0, 0);
    const d = grow([start], start.id, 'decision');
    const x = grow(d.els, d.id);
    const y: ShapeElement = { ...createShape('square', 0, 600), id: 'y', flowchartId: start.id };
    const before = [...x.els, y];
    const after = [...before, { ...createPinnedArrow(d.id, 's', 'y', 'n'), id: 'drawn' }];
    const out = settleFlowcharts(before, after);
    // The grown exit already said Yes.
    expect((out.find((e) => e.id === 'drawn') as ArrowElement).label).toBe('No');
  });

  it('moves a step dragged into another lane into that lane', () => {
    const c = chart();
    const laned = addFlowchartLane(c.els, c.start, ['l1', 'l2']);
    const l2 = box(laned, 'l2');
    const a = box(laned, c.a);
    const dropped = laned.map((e) =>
      e.id === c.a ? { ...a, y: l2.y + l2.height / 2 - a.height / 2 } : e,
    );
    const out = settleFlowcharts(laned, dropped);
    const moved = box(out, c.a);
    expect(moved.flowLaneId).toBe('l2');
    expect(moved.y).toBeGreaterThanOrEqual(box(out, 'l2').y);
  });

  it('keeps a step dragged within its own lane where it was dropped', () => {
    const c = chart();
    const laned = addFlowchartLane(c.els, c.start, ['l1', 'l2']);
    const a = box(laned, c.a);
    const dropped = laned.map((e) => (e.id === c.a ? { ...a, x: a.x + 30 } : e));
    expect(box(settleFlowcharts(laned, dropped), c.a).x).toBe(a.x + 30);
  });

  it('settles a 2,000-element tab with a chart within budget', () => {
    const c = chart();
    const filler = Array.from({ length: 2000 }, (_, i) => ({
      ...createShape('square', i * 10, 0),
      id: `f${i}`,
    }));
    const before = [...filler, ...c.els];
    const after = before.map((e) => (e.id === 'f5' ? { ...e, x: 1 } : e));
    expect(cpuMsOf(() => settleFlowcharts(before, after))).toBeLessThan(cpuBudgetMs(100));
  });
});
