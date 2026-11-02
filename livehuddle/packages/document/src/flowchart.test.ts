import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createPinnedArrow } from './factories';
import {
  FLOWCHART_STEP_KIND,
  FLOWCHART_STEP_SIZE,
  FLOWCHART_STEP_TYPES,
  createFlowchartStart,
  createFlowchartStep,
  decisionExitLabel,
  flowchartAnchor,
  flowchartConnectors,
  flowchartDirectionOf,
  flowchartIds,
  flowchartLanes,
  flowchartStepTypeOf,
  flowchartSteps,
  isFlowchartStep,
  type FlowchartStepType,
} from './flowchart';
import { FLOWCHART_LANE_MIN, layoutFlowchart, relayoutFlowchart } from './flowchart-layout';
import {
  addFlowchartLane,
  applyFlowchartStep,
  moveStepToLane,
  planFlowchartStep,
  retypeFlowchartStep,
  setFlowchartDirection,
} from './flowchart-grow';
import { duplicateElements } from './duplicate';
import { createShape } from './shape-factory';
import { elementKindLabel } from './element-kind-label';
import type { ArrowElement, Element, ShapeElement } from './index';

// docs/specs/009-elements/flowchart.md and its blueprint.

const CHART = 'start';

const step = (id: string, type: FlowchartStepType = 'process', x = 0, y = 0): ShapeElement => ({
  ...createFlowchartStep(type, x, y),
  id,
  flowchartId: CHART,
});
const link = (from: string, to: string, label?: string): ArrowElement => ({
  ...createPinnedArrow(from, 's', to, 'n'),
  id: `${from}-${to}`,
  ...(label ? { label } : {}),
});
const box = (els: readonly Element[], id: string) => els.find((e) => e.id === id) as ShapeElement;
const cx = (s: ShapeElement) => s.x + s.width / 2;
const cy = (s: ShapeElement) => s.y + s.height / 2;

let n = 0;
const ids = () => ({ step: `s${++n}`, connector: `c${n}` });

// Grow `kind` from `from`, landing the plan as the editor does.
function grow(
  els: Element[],
  from: string,
  kind: 'next' | 'parallel' = 'next',
  type?: FlowchartStepType,
) {
  const plan = planFlowchartStep(els, from, kind, ids(), type)!;
  return { els: applyFlowchartStep(els, plan), plan };
}

describe('steps and charts', () => {
  it('a step is a step-type shape carrying a chart id', () => {
    expect(isFlowchartStep(step('a'))).toBe(true);
    expect(isFlowchartStep({ ...step('a'), flowchartId: undefined })).toBe(false);
    expect(isFlowchartStep({ ...step('a'), flowchartId: '' })).toBe(false);
    expect(isFlowchartStep({ ...step('a'), shape: 'star' })).toBe(false);
  });

  it('every step type is its own kind, and the kind reads back as the type', () => {
    for (const t of FLOWCHART_STEP_TYPES)
      expect(flowchartStepTypeOf(FLOWCHART_STEP_KIND[t])).toBe(t);
    expect(new Set(Object.values(FLOWCHART_STEP_KIND)).size).toBe(FLOWCHART_STEP_TYPES.length);
    expect(flowchartStepTypeOf('star')).toBeUndefined();
  });

  it('a step is named by its step type, a plain shape by its kind', () => {
    expect(elementKindLabel(step('d', 'decision'))).toBe('Decision');
    expect(elementKindLabel({ ...step('d', 'decision'), flowchartId: undefined })).toBe('Diamond');
  });

  it('the palette start is a Start reading "Start" whose id is its chart', () => {
    const s = createFlowchartStart(100, 100);
    expect(s.shape).toBe('stadium');
    expect(s.label).toBe('Start');
    expect(s.flowchartId).toBe(s.id);
    expect(cx(s)).toBe(100);
    expect(cy(s)).toBe(100);
  });

  it('connectors are arrows between two steps of the same chart, never a self-loop', () => {
    const other: ShapeElement = { ...step('x'), flowchartId: 'other' };
    const els = [step('a'), step('b'), other, link('a', 'b'), link('a', 'x'), link('a', 'a')];
    expect(flowchartConnectors(els, CHART).map((c) => c.id)).toEqual(['a-b']);
    expect(flowchartIds(els)).toEqual([CHART, 'other']);
  });

  it('the anchor is the step whose id is the chart, else the earliest in reading order', () => {
    expect(
      flowchartAnchor([step('b', 'process', 0, 0), step(CHART, 'process', 0, 500)], CHART)!.id,
    ).toBe(CHART);
    expect(
      flowchartAnchor([step('b', 'process', 0, 500), step('c', 'process', 50, 0)], CHART)!.id,
    ).toBe('c');
  });

  it('flows down by default, right once laned, and as chosen when chosen', () => {
    expect(flowchartDirectionOf([step(CHART)], CHART)).toBe('down');
    const laned = addFlowchartLane([step(CHART)], CHART, ['l1', 'l2']);
    expect(flowchartDirectionOf(laned, CHART)).toBe('right');
    expect(flowchartDirectionOf([{ ...step(CHART), flowDirection: 'right' }], CHART)).toBe('right');
  });
});

describe('decision exits', () => {
  it('say Yes, then No, then nothing', () => {
    const d = step('d', 'decision');
    let els: Element[] = [d];
    expect(decisionExitLabel(els, 'd')).toBe('Yes');
    els = [...els, step('y'), link('d', 'y', 'Yes')];
    expect(decisionExitLabel(els, 'd')).toBe('No');
    els = [...els, step('n'), link('d', 'n', ' no ')];
    expect(decisionExitLabel(els, 'd')).toBeUndefined();
  });

  it('a non-decision step labels nothing', () => {
    expect(decisionExitLabel([step('p')], 'p')).toBeUndefined();
  });

  it('a renamed Yes frees "Yes" for the next exit', () => {
    const els = [step('d', 'decision'), step('y'), link('d', 'y', 'Approved')];
    expect(decisionExitLabel(els, 'd')).toBe('Yes');
  });
});

describe('layout', () => {
  it('ranks a chain along the flow and keeps the first step where it is', () => {
    const start = step(CHART, 'terminator', 400, 300);
    const els = [
      start,
      step('b', 'process', 0, 0),
      step('c', 'decision', 900, 50),
      link(CHART, 'b'),
      link('b', 'c'),
    ];
    const laid = relayoutFlowchart(els, CHART);
    expect(box(laid, CHART)).toMatchObject({ x: 400, y: 300 });
    expect(box(laid, 'b').y).toBeGreaterThan(box(laid, CHART).y + box(laid, CHART).height);
    expect(box(laid, 'c').y).toBeGreaterThan(box(laid, 'b').y + box(laid, 'b').height);
    // A straight chain runs straight.
    expect(cx(box(laid, 'b'))).toBe(cx(box(laid, CHART)));
    expect(cx(box(laid, 'c'))).toBe(cx(box(laid, CHART)));
  });

  it('keeps every step its own size', () => {
    const els = [step(CHART, 'terminator'), step('d', 'decision'), link(CHART, 'd')];
    const laid = relayoutFlowchart(els, CHART);
    expect(box(laid, 'd')).toMatchObject(FLOWCHART_STEP_SIZE.decision);
    expect(box(laid, CHART)).toMatchObject(FLOWCHART_STEP_SIZE.terminator);
  });

  it('flows right when the chart flows right', () => {
    const els = [{ ...step(CHART), flowDirection: 'right' as const }, step('b'), link(CHART, 'b')];
    const laid = relayoutFlowchart(els, CHART);
    expect(box(laid, 'b').x).toBeGreaterThan(box(laid, CHART).x + box(laid, CHART).width);
    expect(cy(box(laid, 'b'))).toBe(cy(box(laid, CHART)));
  });

  it('lays out a merge and a loop without losing a step', () => {
    const els: Element[] = [
      step(CHART, 'terminator'),
      step('d', 'decision'),
      step('a'),
      step('b'),
      step('m'),
      link(CHART, 'd'),
      link('d', 'a', 'Yes'),
      link('d', 'b', 'No'),
      link('a', 'm'),
      link('b', 'm'),
      link('m', 'd'),
    ];
    const laid = relayoutFlowchart(els, CHART);
    const m = box(laid, 'm');
    expect(m.y).toBeGreaterThan(box(laid, 'a').y);
    expect(box(laid, 'a').y).toBe(box(laid, 'b').y);
    // The loop runs back up: it is a connector, not a rank.
    expect(box(laid, 'd').y).toBeLessThan(m.y);
  });

  it('puts the steps on the flow faces of their connectors', () => {
    const els = [
      step(CHART),
      step('b', 'process', 500, -400),
      {
        ...link(CHART, 'b'),
        from: { kind: 'pinned' as const, elementId: CHART, anchor: 'e' as const },
      },
    ];
    const laid = relayoutFlowchart(els, CHART);
    const c = laid.find((e) => e.id === `${CHART}-b`) as ArrowElement;
    expect(c.from).toMatchObject({ anchor: 's' });
    expect(c.to).toMatchObject({ anchor: 'n' });
  });

  it('lines unconnected steps up beside the chart, and never moves the first step', () => {
    const els = [
      step(CHART, 'terminator', 0, 0),
      step('b'),
      step('loose', 'process', -900, -900),
      link(CHART, 'b'),
    ];
    const laid = relayoutFlowchart(els, CHART);
    const right = Math.max(
      box(laid, CHART).x + box(laid, CHART).width,
      box(laid, 'b').x + box(laid, 'b').width,
    );
    expect(box(laid, 'loose').x).toBeGreaterThan(right);
    const alone = relayoutFlowchart(
      [step(CHART, 'terminator', 40, 40), step('z', 'process', 900, 900)],
      CHART,
    );
    expect(box(alone, CHART)).toMatchObject({ x: 40, y: 40 });
  });

  it('leaves a locked step where it is', () => {
    const els = [
      step(CHART),
      { ...step('b', 'process', 777, 777), locked: true },
      link(CHART, 'b'),
    ];
    const laid = relayoutFlowchart(els, CHART);
    expect(box(laid, 'b')).toMatchObject({ x: 777, y: 777 });
  });

  it('holds only what changes', () => {
    const els = [step(CHART), step('b'), link(CHART, 'b')];
    const once = relayoutFlowchart(els, CHART);
    const again = layoutFlowchart(once, CHART);
    expect(again.steps.size + again.lanes.size + again.connectors.size).toBe(0);
  });

  it('lands on whole pixels', () => {
    const els = [
      step(CHART, 'terminator', 10.5, 3.25),
      step('b', 'io'),
      step('c', 'database'),
      link(CHART, 'b'),
      link(CHART, 'c'),
    ];
    for (const el of relayoutFlowchart(els, CHART))
      if (el.type === 'shape' && el.id !== CHART)
        expect([Number.isInteger(el.x), Number.isInteger(el.y)]).toEqual([true, true]);
  });

  it('lays out 200 steps within budget', () => {
    const els: Element[] = [step(CHART, 'terminator')];
    for (let i = 1; i < 200; i += 1) {
      els.push(step(`p${i}`, i % 7 === 0 ? 'decision' : 'process'));
      els.push(link(i === 1 ? CHART : `p${Math.floor(i / 2) || 1}`, `p${i}`));
      if (i % 3 === 0) els.push(link(`p${i}`, `p${Math.max(1, i - 5)}`));
    }
    const ms = cpuMsOf(() => relayoutFlowchart(els, CHART));
    expect(ms).toBeLessThan(cpuBudgetMs(250));
  });
});

describe('growth', () => {
  it('Tab adds a Process after the step, connected, in the chart, and lays it out', () => {
    const start = createFlowchartStart(0, 0);
    const { els, plan } = grow([start], start.id);
    expect(plan.step).toMatchObject({
      shape: 'square',
      flowchartId: start.id,
      ...FLOWCHART_STEP_SIZE.process,
    });
    expect(plan.connector.from).toMatchObject({ elementId: start.id });
    expect(plan.connector.to).toMatchObject({ elementId: plan.step.id });
    expect(plan.connector.arrowStyle).toBe('angled');
    expect(box(els, start.id)).toMatchObject({ x: start.x, y: start.y });
    expect(cx(box(els, plan.step.id))).toBe(cx(start));
    expect(box(els, plan.step.id).y).toBeGreaterThan(start.y + start.height);
  });

  it('grows a chosen type', () => {
    const start = createFlowchartStart(0, 0);
    expect(grow([start], start.id, 'next', 'decision').plan.step.shape).toBe('diamond');
  });

  it("a Decision's exits come out Yes then No, Yes before No", () => {
    const d: ShapeElement = {
      ...createFlowchartStep('decision', 0, 0),
      id: CHART,
      flowchartId: CHART,
    };
    const first = grow([d], CHART);
    const second = grow(first.els, CHART);
    expect(first.plan.connector.label).toBe('Yes');
    expect(second.plan.connector.label).toBe('No');
    const yes = box(second.els, first.plan.step.id);
    const no = box(second.els, second.plan.step.id);
    expect(yes.y).toBe(no.y);
    expect(cx(yes)).toBeLessThan(cx(no));
  });

  it('Enter adds a parallel step from the same source, beside it', () => {
    const start = createFlowchartStart(0, 0);
    const a = grow([start], start.id);
    const b = grow(a.els, a.plan.step.id, 'parallel');
    expect(b.plan.connector.from).toMatchObject({ elementId: start.id });
    expect(box(b.els, b.plan.step.id).y).toBe(box(b.els, a.plan.step.id).y);
    expect(cx(box(b.els, b.plan.step.id))).toBeGreaterThan(cx(box(b.els, a.plan.step.id)));
  });

  it('Enter on a step nothing leads to grows its next step', () => {
    const start = createFlowchartStart(0, 0);
    const { plan } = grow([start], start.id, 'parallel');
    expect(plan.connector.from).toMatchObject({ elementId: start.id });
  });

  it('a new step inherits its lane and direction', () => {
    const start: ShapeElement = {
      ...createFlowchartStart(0, 0),
      flowDirection: 'right',
      flowLaneId: 'L',
    };
    const { plan } = grow([start], start.id);
    expect(plan.step).toMatchObject({ flowDirection: 'right', flowLaneId: 'L' });
  });

  it('copies the look of the latest step of its own type', () => {
    const start = createFlowchartStart(0, 0);
    const tinted = grow([start], start.id);
    const els = tinted.els.map((e) =>
      e.id === tinted.plan.step.id ? { ...e, fillColor: '#ff0000' } : e,
    );
    const next = planFlowchartStep(els, tinted.plan.step.id, 'next', ids())!;
    expect(next.styleFrom?.id).toBe(tinted.plan.step.id);
    expect(planFlowchartStep([start], start.id, 'next', ids())!.styleFrom).toBeNull();
  });

  it('is null from anything that is not a step', () => {
    expect(
      planFlowchartStep([{ ...step('a'), flowchartId: undefined }], 'a', 'next', ids()),
    ).toBeNull();
  });
});

describe('connector routes', () => {
  it("sends a Decision's exits out of its side corners when neither carries straight on", () => {
    const d: ShapeElement = {
      ...createFlowchartStep('decision', 0, 0),
      id: CHART,
      flowchartId: CHART,
    };
    const first = grow([d], CHART);
    const lone = first.els.find((e) => e.id === first.plan.connector.id) as ArrowElement;
    expect(lone.arrowStyle).toBe('straight');
    expect(lone.from).toMatchObject({ anchor: 's' });
    const second = grow(first.els, CHART);
    const yes = second.els.find((e) => e.id === first.plan.connector.id) as ArrowElement;
    const no = second.els.find((e) => e.id === second.plan.connector.id) as ArrowElement;
    expect(yes).toMatchObject({ arrowStyle: 'angled', from: { anchor: 'w' }, to: { anchor: 'n' } });
    expect(no).toMatchObject({ arrowStyle: 'angled', from: { anchor: 'e' }, to: { anchor: 'n' } });
    expect(yes.curvePoints).toBeUndefined();
  });

  it("turns a Decision's exits out of its top and bottom corners when the chart flows right", () => {
    const els: Element[] = [
      { ...step(CHART, 'decision'), flowDirection: 'right' },
      step('a'),
      step('b'),
      link(CHART, 'a', 'Yes'),
      link(CHART, 'b', 'No'),
    ];
    const laid = relayoutFlowchart(els, CHART);
    const anchors = [`${CHART}-a`, `${CHART}-b`].map(
      (id) => ((laid.find((e) => e.id === id) as ArrowElement).from as { anchor: string }).anchor,
    );
    expect(anchors.sort()).toEqual(['n', 's']);
  });

  it("bends a Process's offset branches twice", () => {
    const start = createFlowchartStart(0, 0);
    const a = grow([start], start.id);
    const b = grow(a.els, a.plan.step.id, 'parallel');
    const c = b.els.find((e) => e.id === b.plan.connector.id) as ArrowElement;
    expect(c.arrowStyle).toBe('angled');
    expect(c.curvePoints).toHaveLength(2);
  });

  it("leaves a curved connector's look alone", () => {
    const els = [
      step(CHART),
      step('b', 'process', 400, 400),
      { ...link(CHART, 'b'), arrowStyle: 'curved' as const },
    ];
    const c = relayoutFlowchart(els, CHART).find((e) => e.id === `${CHART}-b`) as ArrowElement;
    expect(c.arrowStyle).toBe('curved');
  });
});

describe('loops', () => {
  // The checkout: a declined card loops back to the form; a back-order rejoins at the receipt.
  const checkout = (): Element[] => [
    step(CHART, 'terminator'),
    step('input', 'io'),
    step('charge'),
    step('paid', 'decision'),
    step('stock', 'decision'),
    step('receipt', 'document'),
    step('error'),
    step('back'),
    link(CHART, 'input'),
    link('input', 'charge'),
    link('charge', 'paid'),
    link('paid', 'stock', 'Yes'),
    link('paid', 'error', 'No'),
    link('error', 'input', 'Try again'),
    link('stock', 'receipt', 'Yes'),
    link('stock', 'back', 'No'),
    link('back', 'receipt'),
  ];

  it('never lets a loop flatten the steps after it', () => {
    const laid = relayoutFlowchart(checkout(), CHART);
    expect(box(laid, 'receipt').y).toBeGreaterThan(box(laid, 'back').y + box(laid, 'back').height);
  });

  it('is a fixed point: laying a laid-out chart out again changes nothing', () => {
    const once = relayoutFlowchart(checkout(), CHART);
    const again = layoutFlowchart(once, CHART);
    expect(again.steps.size + again.lanes.size + again.connectors.size).toBe(0);
    const right = relayoutFlowchart(checkout(), CHART, { direction: 'right' });
    const r2 = layoutFlowchart(right, CHART, { direction: 'right' });
    expect(r2.steps.size + r2.lanes.size + r2.connectors.size).toBe(0);
  });

  it("turns a Decision's exit out of a corner only toward a step beyond it", () => {
    const laid = relayoutFlowchart(checkout(), CHART);
    const stock = box(laid, 'stock');
    for (const id of ['stock-receipt', 'stock-back']) {
      const c = laid.find((e) => e.id === id) as ArrowElement;
      const target = box(laid, id.split('-')[1]!);
      const beyond =
        Math.abs(target.x + target.width / 2 - (stock.x + stock.width / 2)) > stock.width / 2;
      expect((c.from as { anchor: string }).anchor === 's').toBe(!beyond);
    }
  });

  it('sends a loop round whichever side is the shorter trip', () => {
    // Two branches, the loop on the left one: it goes round the left.
    const els: Element[] = [
      step(CHART, 'decision'),
      step('l'),
      step('r'),
      step('l2'),
      link(CHART, 'l', 'Yes'),
      link(CHART, 'r', 'No'),
      link('l', 'l2'),
      link('l2', 'l'),
    ];
    const laid = relayoutFlowchart(els, CHART);
    expect(box(laid, 'l').x).toBeLessThan(box(laid, 'r').x);
    const loop = laid.find((e) => e.id === 'l2-l') as ArrowElement;
    expect(loop).toMatchObject({ from: { anchor: 'w' }, to: { anchor: 'w' } });
  });

  it('routes a loop round the outside of every step it passes, side to side', () => {
    const laid = relayoutFlowchart(checkout(), CHART);
    const loop = laid.find((e) => e.id === 'error-input') as ArrowElement;
    expect(loop).toMatchObject({
      arrowStyle: 'angled',
      from: { anchor: 'e' },
      to: { anchor: 'e' },
    });
    const error = box(laid, 'error');
    const input = box(laid, 'input');
    const mx = (error.x + error.width + input.x + input.width) / 2;
    const corner = mx + loop.curvePoints![0]!.dx;
    const steps = laid.filter((e) => e.type === 'shape');
    const between = steps.filter((s) => s.y < error.y + error.height && s.y + s.height > input.y);
    for (const s of between) expect(corner).toBeGreaterThan(s.x + s.width);
  });
});

describe('changes', () => {
  it('retyping swaps kind and size about the centre, keeping the look', () => {
    const els = [
      step(CHART, 'terminator'),
      { ...step('b'), fillColor: '#123456', label: 'Check' },
      link(CHART, 'b'),
    ];
    const laid = relayoutFlowchart(els, CHART);
    const out = retypeFlowchartStep(laid, 'b', 'decision');
    expect(box(out, 'b')).toMatchObject({
      shape: 'diamond',
      ...FLOWCHART_STEP_SIZE.decision,
      fillColor: '#123456',
      label: 'Check',
    });
    expect(cx(box(out, 'b'))).toBe(cx(box(laid, 'b')));
    expect(retypeFlowchartStep(laid, 'b', 'process')).toBe(laid);
  });

  it('a direction change is written to every step and re-flows the chart', () => {
    const els = [step(CHART), step('b'), link(CHART, 'b')];
    const out = setFlowchartDirection(els, CHART, 'right');
    expect(flowchartSteps(out, CHART).every((s) => s.flowDirection === 'right')).toBe(true);
    expect(box(out, 'b').x).toBeGreaterThan(box(out, CHART).x);
  });
});

describe('lanes', () => {
  const chart = () => {
    const start = createFlowchartStart(0, 0);
    let els: Element[] = [start];
    const a = grow(els, start.id);
    els = a.els;
    const b = grow(els, a.plan.step.id);
    return { els: b.els, start: start.id, a: a.plan.step.id, b: b.plan.step.id };
  };

  it('Add Lane on an unlaned chart makes two lanes, every step in the first, flowing right', () => {
    const c = chart();
    const out = addFlowchartLane(c.els, c.start, ['l1', 'l2']);
    const lanes = flowchartLanes(out, c.start);
    expect(lanes.map((l) => l.label)).toEqual(['Lane 1', 'Lane 2']);
    expect(flowchartSteps(out, c.start).every((s) => s.flowLaneId === 'l1')).toBe(true);
    expect(out.findIndex((e) => e.id === 'l1')).toBeLessThan(
      out.findIndex((e) => e.id === c.start),
    );
    const [l1, l2] = lanes;
    // Rows, flush, the same length, the first step still where it was.
    expect(l1!.width).toBeGreaterThan(l1!.height);
    expect(l2!.y).toBe(l1!.y + l1!.height);
    expect(l2!.x).toBe(l1!.x);
    expect(l2!.width).toBe(l1!.width);
    expect(l2!.height).toBe(FLOWCHART_LANE_MIN);
    expect(box(out, c.start)).toMatchObject({ x: box(c.els, c.start).x, y: box(c.els, c.start).y });
    for (const s of flowchartSteps(out, c.start)) {
      expect(s.y).toBeGreaterThanOrEqual(l1!.y);
      expect(s.y + s.height).toBeLessThanOrEqual(l1!.y + l1!.height);
      expect(s.x).toBeGreaterThan(l1!.x);
    }
  });

  it('a later Add Lane appends one more', () => {
    const c = chart();
    const two = addFlowchartLane(c.els, c.start, ['l1', 'l2']);
    const three = addFlowchartLane(two, c.start, ['l3', 'unused']);
    expect(
      flowchartLanes(three, c.start)
        .map((l) => l.label)
        .sort(),
    ).toEqual(['Lane 1', 'Lane 2', 'Lane 3']);
    const l3 = box(three, 'l3');
    const l2 = box(three, 'l2');
    expect(l3.y).toBe(l2.y + l2.height);
  });

  it('moving a step to another lane puts it in that band, its column kept', () => {
    const c = chart();
    const laned = addFlowchartLane(c.els, c.start, ['l1', 'l2']);
    const before = box(laned, c.a);
    const out = moveStepToLane(laned, c.a, 'l2');
    const l2 = box(out, 'l2');
    const a = box(out, c.a);
    expect(a.flowLaneId).toBe('l2');
    expect(a.y).toBeGreaterThanOrEqual(l2.y);
    expect(a.y + a.height).toBeLessThanOrEqual(l2.y + l2.height);
    expect(a.x).toBe(before.x);
    expect(moveStepToLane(out, c.a, 'l2')).toBe(out);
    expect(moveStepToLane(out, c.a, 'nope')).toBe(out);
  });

  it('a new step grows into the lane of the step it grew from', () => {
    const c = chart();
    const out = moveStepToLane(addFlowchartLane(c.els, c.start, ['l1', 'l2']), c.b, 'l2');
    const { els, plan } = grow(out, c.b);
    const l2 = box(els, 'l2');
    expect(plan.step.flowLaneId).toBe('l2');
    expect(box(els, plan.step.id).y).toBeGreaterThanOrEqual(l2.y);
  });

  it('flowing down turns the lanes into columns with their title on top', () => {
    const c = chart();
    const out = setFlowchartDirection(
      addFlowchartLane(c.els, c.start, ['l1', 'l2']),
      c.start,
      'down',
    );
    const l1 = box(out, 'l1');
    const l2 = box(out, 'l2');
    expect(l1.height).toBeGreaterThan(l1.width);
    expect(l1).toMatchObject({ textAlignX: 'center', textAlignY: 'top' });
    expect(l2.x).toBe(l1.x + l1.width);
    for (const s of flowchartSteps(out, c.start)) {
      expect(s.x).toBeGreaterThanOrEqual(l1.x);
      expect(s.x + s.width).toBeLessThanOrEqual(l1.x + l1.width);
    }
  });

  it("runs a connector that skips a rank along its target lane's free strip, clear of every step", () => {
    const els: Element[] = [
      { ...step(CHART, 'terminator'), flowLaneId: 'l1' },
      { ...step('mid'), flowLaneId: 'l1' },
      { ...step('end'), flowLaneId: 'l1' },
      { ...createShape('lane', 0, 0), id: 'l1', flowchartId: CHART },
      link(CHART, 'mid'),
      link('mid', 'end'),
      link(CHART, 'end'),
    ];
    const laid = relayoutFlowchart(els, CHART);
    const skip = laid.find((e) => e.id === `${CHART}-end`) as ArrowElement;
    const mid = box(laid, 'mid');
    const lane = box(laid, 'l1');
    expect(skip.curvePoints).toHaveLength(4);
    const start = box(laid, CHART);
    const end = box(laid, 'end');
    const my = (start.y + start.height / 2 + end.y + end.height / 2) / 2;
    const strip = my + skip.curvePoints![1]!.dy;
    expect(strip).toBeGreaterThan(lane.y);
    expect(strip).toBeLessThan(mid.y);
  });

  it('a step whose lane is gone sits in the first lane', () => {
    const c = chart();
    const laned = moveStepToLane(addFlowchartLane(c.els, c.start, ['l1', 'l2']), c.a, 'l2');
    const out = relayoutFlowchart(
      laned.filter((e) => e.id !== 'l2'),
      c.start,
    );
    const l1 = box(out, 'l1');
    const a = box(out, c.a);
    expect(a.y + a.height).toBeLessThanOrEqual(l1.y + l1.height);
  });
});

describe('copies', () => {
  it('a copied chart is a new chart, its lanes followed and missing lanes dropped', () => {
    const start = createFlowchartStart(0, 0);
    const a = grow([start], start.id);
    const laned = addFlowchartLane(a.els, start.id, ['l1', 'l2']);
    const { newElements, idMap } = duplicateElements(
      laned,
      new Set([start.id, a.plan.step.id, 'l1']),
      40,
      40,
    );
    const copyStart = newElements.find((e) => e.id === idMap.get(start.id)) as ShapeElement;
    expect(copyStart.flowchartId).toBe(copyStart.id);
    for (const el of newElements)
      if (el.type === 'shape') expect(el.flowchartId).toBe(copyStart.id);
    expect(copyStart.flowLaneId).toBe(idMap.get('l1'));

    const lone = duplicateElements(laned, new Set([a.plan.step.id]), 40, 40)
      .newElements[0] as ShapeElement;
    expect(lone.flowchartId).toBe(lone.id);
    expect(lone.flowLaneId).toBeUndefined();
  });
});
