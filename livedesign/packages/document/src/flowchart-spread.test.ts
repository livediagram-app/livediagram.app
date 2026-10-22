import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@livepages/vitest-config/cpu-time';
import { createPinnedArrow } from './factories';
import { createFlowchartStep, type FlowchartStepType } from './flowchart';
import { addFlowchartLane, moveStepToLane } from './flowchart-grow';
import { relayoutFlowchart } from './flowchart-layout';
import { FLOWCHART_CORNER_CLEARANCE, spreadDecisionExits } from './flowchart-spread';
import type { Pt } from './auto-layout-shared';
import type { ArrowElement, Element, ShapeElement } from './index';

// docs/specs/009-elements/flowchart.md "A Decision's steps sit beyond its corners" and "No two exits of
// a Decision share a face"; blueprint flowchart.md "Layout" steps 3 and 5.

const CHART = 'd';
const step = (id: string, type: FlowchartStepType = 'process'): ShapeElement => ({
  ...createFlowchartStep(type, 0, 0),
  id,
  flowchartId: CHART,
});
const link = (from: string, to: string, label?: string): ArrowElement => ({
  ...createPinnedArrow(from, 's', to, 'n'),
  id: `${from}-${to}`,
  ...(label ? { label } : {}),
});
const centreX = (s: ShapeElement, p: Pt) => p.x + s.width / 2;
const anchorOf = (els: readonly Element[], id: string) =>
  ((els.find((e) => e.id === id) as ArrowElement).from as { anchor: string }).anchor;

describe('spreadDecisionExits', () => {
  // A Decision (200 wide, centre 100) with both steps under its middle, the left one leading on.
  const setup = () => {
    const d = step('d', 'decision');
    const a = step('a');
    const b = step('b');
    const a2 = step('a2');
    const steps = [d, a, b, a2];
    const arrows = [link('d', 'a'), link('d', 'b'), link('a', 'a2')];
    const pos = new Map<string, Pt>([
      ['d', { x: 0, y: 0 }],
      ['a', { x: -90, y: 210 }],
      ['b', { x: 130, y: 210 }],
      ['a2', { x: -90, y: 372 }],
    ]);
    return { steps, arrows, pos, d, a, b, a2 };
  };

  it('moves the first step beyond the left corner and the last beyond the right, flowing down', () => {
    const { steps, arrows, pos, a, b } = setup();
    spreadDecisionExits(pos, steps, arrows, 'down', 'd');
    expect(centreX(a, pos.get('a')!)).toBe(0 - FLOWCHART_CORNER_CLEARANCE);
    expect(centreX(b, pos.get('b')!)).toBe(200 + FLOWCHART_CORNER_CLEARANCE);
    expect(pos.get('d')).toEqual({ x: 0, y: 0 });
  });

  it('carries the steps only a moved step leads to', () => {
    const { steps, arrows, pos } = setup();
    const before = pos.get('a2')!.x - pos.get('a')!.x;
    spreadDecisionExits(pos, steps, arrows, 'down', 'd');
    expect(pos.get('a2')!.x - pos.get('a')!.x).toBe(before);
  });

  it('leaves a step the other exit also reaches where it is (a merge)', () => {
    const { steps, arrows, pos } = setup();
    const merged = [...arrows, link('b', 'a2')];
    const at = pos.get('a2');
    spreadDecisionExits(pos, steps, merged, 'down', 'd');
    expect(pos.get('a2')).toEqual(at);
  });

  it('never moves the first step of the chart', () => {
    const { steps, arrows, pos } = setup();
    const at = pos.get('a');
    spreadDecisionExits(pos, steps, arrows, 'down', 'a');
    expect(pos.get('a')).toEqual(at);
  });

  it('skips a move that would crowd another step', () => {
    const { steps, arrows, pos } = setup();
    const x = step('x');
    pos.set('x', { x: -330, y: 210 });
    const at = pos.get('a');
    spreadDecisionExits(pos, [...steps, x], arrows, 'down', 'd');
    expect(pos.get('a')).toEqual(at);
  });

  it('spreads across the rows when the chart flows right', () => {
    const d = step('d', 'decision');
    const a = step('a');
    const b = step('b');
    const pos = new Map<string, Pt>([
      ['d', { x: 0, y: 0 }],
      ['a', { x: 290, y: 0 }],
      ['b', { x: 290, y: 100 }],
    ]);
    spreadDecisionExits(pos, [d, a, b], [link('d', 'a'), link('d', 'b')], 'right', 'd');
    expect(pos.get('a')!.y + a.height / 2).toBe(-FLOWCHART_CORNER_CLEARANCE);
    expect(pos.get('b')!.y + b.height / 2).toBe(d.height + FLOWCHART_CORNER_CLEARANCE);
  });

  it('leaves a Decision with one exit, and a step already clear, alone', () => {
    const { steps, pos } = setup();
    const before = new Map(pos);
    spreadDecisionExits(pos, steps, [link('d', 'a')], 'down', 'd');
    expect(pos).toEqual(before);
  });
});

describe('a laid-out chart', () => {
  it('gives the two exits of a merging Decision their own faces (the Flowchart template shape)', () => {
    // d → a → m and d → m: the merge sits a rank further on, under the Decision.
    const els: Element[] = [
      step(CHART, 'decision'),
      step('a'),
      step('m'),
      link(CHART, 'm', 'Yes'),
      link(CHART, 'a', 'No'),
      link('a', 'm'),
    ];
    const laid = relayoutFlowchart(els, CHART);
    expect(anchorOf(laid, `${CHART}-m`)).not.toBe(anchorOf(laid, `${CHART}-a`));
    expect(relayoutFlowchart(laid, CHART)).toEqual(laid);
  });

  it('on a laned chart, sends the further of two exits sharing a corner out of the flow face', () => {
    // Flowing right, the Decision in the first lane and both of its steps in the second, a rank apart.
    let els: Element[] = [
      step(CHART, 'decision'),
      step('near'),
      step('far'),
      link(CHART, 'near', 'No'),
      link(CHART, 'far', 'Yes'),
      link('near', 'far'),
    ];
    els = addFlowchartLane(els, CHART, ['l1', 'l2']);
    els = moveStepToLane(els, 'near', 'l2');
    els = moveStepToLane(els, 'far', 'l2');
    const laid = relayoutFlowchart(els, CHART);
    expect(anchorOf(laid, `${CHART}-near`)).toBe('s');
    expect(anchorOf(laid, `${CHART}-far`)).toBe('e');
  });
});

describe('cost', () => {
  it('lays out a 200-step tree of Decisions within budget (every step a spread)', () => {
    // The worst case for the spread: every inner step a Decision with two exits, each moving a subtree.
    const els: Element[] = [step(CHART, 'decision')];
    for (let i = 1; i < 200; i += 1) {
      const parent = i < 3 ? CHART : `p${Math.floor((i - 1) / 2)}`;
      els.push(step(`p${i}`, i < 100 ? 'decision' : 'process'));
      els.push(link(parent, `p${i}`));
    }
    const ms = cpuMsOf(() => relayoutFlowchart(els, CHART));
    expect(ms).toBeLessThan(cpuBudgetMs(250));
  });
});
