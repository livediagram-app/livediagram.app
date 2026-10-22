import { describe, expect, it } from 'vitest';
import { createShape } from './factories';
import { MIND_SIBLING_GAP_Y } from './mind-flow';
import { fitMindNodeHeight } from './mind-fit';
import { planMindGrowth, type MindGrowthPlan } from './mind-grow';
import { isMindTreeTidy } from './mind-layout';
import type { Element, ShapeElement } from './index';

// docs/specs/009-elements/mind-node.md "A node grows to fit its label".

const node = (id: string, parent?: string, at: { x?: number; y?: number } = {}): ShapeElement => ({
  ...createShape('mind-node', at.x ?? 0, at.y ?? 0),
  id,
  width: 200,
  height: 60,
  ...(parent ? { mindParentId: parent } : {}),
});

const apply = (els: Element[], plan: MindGrowthPlan): Element[] => {
  const moved = new Map(plan.moves.map((m) => [m.id, m]));
  const re = new Map(plan.reanchored.map((a) => [a.id, a]));
  const out = els.map((el) => {
    const m = moved.get(el.id);
    if (m) return { ...el, x: m.x, y: m.y };
    return re.get(el.id) ?? el;
  });
  return [...out, plan.node, ...(plan.arrow ? [plan.arrow] : [])];
};

const box = (els: Element[], id: string) => els.find((e) => e.id === id) as ShapeElement;

// A root with three children, built the way the keyboard builds it: tidy.
function tidyMap(): Element[] {
  let els: Element[] = [node('r', undefined, { x: 0, y: 0 })];
  els = apply(els, planMindGrowth(els, 'r', 'child', { node: 'a', arrow: 'ra' })!);
  els = apply(els, planMindGrowth(els, 'a', 'sibling', { node: 'b', arrow: 'rb' })!);
  els = apply(els, planMindGrowth(els, 'b', 'sibling', { node: 'c', arrow: 'rc' })!);
  return els;
}

describe('fitMindNodeHeight', () => {
  it('leaves a node that already fits alone, as the same array', () => {
    const els = tidyMap();
    expect(fitMindNodeHeight(els, 'b', 60)).toBe(els);
    expect(fitMindNodeHeight(els, 'b', 12)).toBe(els);
  });

  it('never shrinks a node', () => {
    const els = tidyMap().map((el) => (el.id === 'b' ? { ...el, height: 140 } : el));
    expect(fitMindNodeHeight(els, 'b', 80)).toBe(els);
  });

  it('grows the node to a whole pixel, keeping its width', () => {
    const els = tidyMap();
    const next = fitMindNodeHeight(els, 'b', 100.2);
    expect(box(next, 'b').height).toBe(101);
    expect(box(next, 'b').width).toBe(200);
  });

  it('lays a tidy map out again, so siblings clear the taller node and it stays tidy', () => {
    const next = fitMindNodeHeight(tidyMap(), 'b', 140);
    const a = box(next, 'a');
    const b = box(next, 'b');
    const c = box(next, 'c');
    expect(b.y - (a.y + a.height)).toBe(MIND_SIBLING_GAP_Y);
    expect(c.y - (b.y + b.height)).toBe(MIND_SIBLING_GAP_Y);
    expect(isMindTreeTidy(next, 'r', 'tree')).toBe(true);
    // The root never moves.
    expect(box(next, 'r')).toMatchObject({ x: 0, y: 0 });
  });

  it('grows a hand-arranged map downward and moves nothing else', () => {
    const els = tidyMap().map((el) => (el.id === 'c' ? { ...el, x: 900, y: 900 } : el));
    const next = fitMindNodeHeight(els, 'b', 140);
    expect(box(next, 'b')).toMatchObject({ x: box(els, 'b').x, y: box(els, 'b').y, height: 140 });
    for (const id of ['r', 'a', 'c']) expect(box(next, id)).toEqual(box(els, id));
  });

  it('ignores anything that is not a mind node, and a height that is not a number', () => {
    const square = { ...createShape('square', 0, 0), id: 's' };
    const els: Element[] = [...tidyMap(), square];
    expect(fitMindNodeHeight(els, 's', 400)).toBe(els);
    expect(fitMindNodeHeight(els, 'missing', 400)).toBe(els);
    expect(fitMindNodeHeight(els, 'b', Number.NaN)).toBe(els);
  });
});
