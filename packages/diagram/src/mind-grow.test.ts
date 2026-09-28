import { describe, expect, it } from 'vitest';
import { createPinnedArrow, createShape } from './factories';
import { SHAPE_DEFAULT_SIZE } from './shape-factory';
import { MIND_SIBLING_GAP_Y } from './mind-flow';
import { isMindTreeTidy, layoutMindTree } from './mind-layout';
import {
  planMindGrowth,
  relayoutMindMap,
  withMindSubtrees,
  type MindGrowthPlan,
} from './mind-grow';
import type { ArrowElement, Element, ShapeElement } from './index';

// docs/specs/009-elements/mind-node.md: growth, the level's look, connectors, Tidy Map, branch drags.

const node = (
  id: string,
  parent?: string,
  at: { x?: number; y?: number; w?: number; h?: number } = {},
): ShapeElement => ({
  ...(createShape('mind-node', at.x ?? 0, at.y ?? 0) as ShapeElement),
  id,
  width: at.w ?? 200,
  height: at.h ?? 60,
  ...(parent ? { mindParentId: parent } : {}),
});

const ids = (n: number) => ({ node: `n${n}`, arrow: `a${n}` });

// Apply a plan the way the editor does, so tests can chain growths.
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
const cy = (n: ShapeElement) => n.y + n.height / 2;

describe('planMindGrowth: a tidy map stays tidy', () => {
  it('grows a keyboard-built map into a tidy one, parent centred on its children', () => {
    let els: Element[] = [node('r', undefined, { x: 0, y: 0 })];
    els = apply(els, planMindGrowth(els, 'r', 'child', ids(1))!);
    els = apply(els, planMindGrowth(els, 'n1', 'sibling', ids(2))!);
    els = apply(els, planMindGrowth(els, 'n2', 'sibling', ids(3))!);
    expect(isMindTreeTidy(els, 'r', 'tree')).toBe(true);
    // The middle child is level with the root: the root sits centred.
    expect(cy(box(els, 'n2'))).toBe(cy(box(els, 'r')));
  });

  it('never moves the root', () => {
    let els: Element[] = [node('r', undefined, { x: 40, y: 70 })];
    for (let i = 1; i <= 4; i++) els = apply(els, planMindGrowth(els, 'r', 'child', ids(i))!);
    expect(box(els, 'r')).toMatchObject({ x: 40, y: 70 });
  });

  it('puts a sibling directly after the node Enter was pressed on', () => {
    let els: Element[] = [node('r')];
    els = apply(els, planMindGrowth(els, 'r', 'child', ids(1))!);
    els = apply(els, planMindGrowth(els, 'r', 'child', ids(2))!);
    // Enter on the FIRST child: the new one goes between the two.
    els = apply(els, planMindGrowth(els, 'n1', 'sibling', ids(3))!);
    const order = ['n1', 'n3', 'n2'].map((id) => box(els, id).y);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('lands the growth as moves in the same plan, not a second step', () => {
    let els: Element[] = [node('r')];
    els = apply(els, planMindGrowth(els, 'r', 'child', ids(1))!);
    const plan = planMindGrowth(els, 'r', 'child', ids(2))!;
    // The first child slides up to make the pair centred on the root.
    expect(plan.moves.map((m) => m.id)).toContain('n1');
  });

  it('is deterministic for the ids it is given', () => {
    const els: Element[] = [node('r')];
    expect(planMindGrowth(els, 'r', 'child', ids(1))).toEqual(
      planMindGrowth(els, 'r', 'child', ids(1)),
    );
  });
});

describe('planMindGrowth: a hand-arranged map', () => {
  it('moves none of its nodes (free placement)', () => {
    const els: Element[] = [
      node('r', undefined, { x: 0, y: 0 }),
      node('a', 'r', { x: 400, y: -200 }),
      node('b', 'r', { x: 400, y: 300 }),
    ];
    expect(isMindTreeTidy(els, 'r', 'tree')).toBe(false);
    const plan = planMindGrowth(els, 'r', 'child', ids(1))!;
    expect(plan.moves).toEqual([]);
    expect(plan.node.y).toBe(300 + 60 + MIND_SIBLING_GAP_Y);
  });

  it('pushes another tree out of the way rather than overlapping it', () => {
    const els: Element[] = [
      node('r', undefined, { x: 0, y: 0 }),
      node('other', undefined, { x: 264, y: 0 }),
    ];
    const plan = planMindGrowth(els, 'r', 'child', ids(1))!;
    expect(plan.moves.find((m) => m.id === 'other')!.y).toBeGreaterThan(plan.node.y);
  });
});

describe('planMindGrowth: the level look', () => {
  it('copies a sibling, preferring the one Enter was pressed on', () => {
    const els: Element[] = [node('r'), node('a', 'r', { w: 120 }), node('b', 'r', { w: 150 })];
    expect(planMindGrowth(els, 'a', 'sibling', ids(1))!.styleFrom!.id).toBe('a');
    expect(planMindGrowth(els, 'r', 'child', ids(1))!.styleFrom!.id).toBe('b');
  });

  it('copies a cousin at the same depth before the parent', () => {
    const els: Element[] = [node('r'), node('a', 'r'), node('b', 'r'), node('a1', 'a', { w: 90 })];
    const plan = planMindGrowth(els, 'b', 'child', ids(1))!;
    expect(plan.styleFrom!.id).toBe('a1');
    expect(plan.node.width).toBe(90);
  });

  it("gives a root's first branch the defaults, never the root's look", () => {
    const els: Element[] = [node('r', undefined, { w: 400, h: 120 })];
    const plan = planMindGrowth(els, 'r', 'child', ids(1))!;
    expect(plan.styleFrom).toBeNull();
    expect(plan.node.width).toBe(SHAPE_DEFAULT_SIZE['mind-node'].width);
  });

  it('never makes a first branch bigger than a small root', () => {
    const els: Element[] = [node('r', undefined, { w: 120, h: 40 })];
    expect(planMindGrowth(els, 'r', 'child', ids(1))!.node).toMatchObject({
      width: 120,
      height: 40,
    });
  });

  it('copies the connector look of a sibling', () => {
    const arrow = {
      ...createPinnedArrow('r', 'e', 'a', 'w'),
      arrowStyle: 'angled',
    } as ArrowElement;
    const els: Element[] = [node('r'), node('a', 'r', { x: 264 }), arrow];
    expect(planMindGrowth(els, 'r', 'child', ids(1))!.connectorStyleFrom).toBe(arrow);
  });
});

describe('planMindGrowth: connectors', () => {
  it('joins every tree child east to west, even far down the column', () => {
    let els: Element[] = [node('r')];
    for (let i = 1; i <= 6; i++) {
      const plan = planMindGrowth(els, 'r', 'child', ids(i))!;
      expect(plan.arrow).toMatchObject({ from: { anchor: 'e' }, to: { anchor: 'w' } });
      els = apply(els, plan);
    }
  });

  it('joins a downward child south to north', () => {
    const els: Element[] = [{ ...node('r'), mindFlow: 'downward' }];
    expect(planMindGrowth(els, 'r', 'child', ids(1))!.arrow).toMatchObject({
      from: { anchor: 's' },
      to: { anchor: 'n' },
    });
  });

  it('makes a new root with no connector for Enter on a root', () => {
    const plan = planMindGrowth([node('r')], 'r', 'sibling', ids(1))!;
    expect(plan.arrow).toBeNull();
    expect(plan.node.mindParentId).toBeUndefined();
  });
});

describe('relayoutMindMap', () => {
  it('tidies a hand-arranged map around its root', () => {
    const els: Element[] = [
      node('r', undefined, { x: 0, y: 0 }),
      node('a', 'r', { x: 900, y: -400 }),
      node('b', 'r', { x: 350, y: 700 }),
    ];
    const plan = relayoutMindMap(els, 'b')!;
    const moved = new Map(plan.moves.map((m) => [m.id, m]));
    const out = els.map((el) => (moved.has(el.id) ? { ...el, ...moved.get(el.id)! } : el));
    expect(isMindTreeTidy(out, 'r', 'tree')).toBe(true);
  });

  it('lays a map out in a new flow', () => {
    const tree = [node('r'), node('a', 'r'), node('b', 'r')];
    const laid = tree.map((el) => ({ ...el, ...layoutMindTree(tree, 'r', 'tree').get(el.id)! }));
    const plan = relayoutMindMap(laid, 'r', 'downward')!;
    const moved = new Map(plan.moves.map((m) => [m.id, m]));
    const out = laid.map((el) => (moved.has(el.id) ? { ...el, ...moved.get(el.id)! } : el));
    expect(isMindTreeTidy(out, 'r', 'downward')).toBe(true);
    // Read top to bottom before, left to right after.
    expect(box(out, 'a').x).toBeLessThan(box(out, 'b').x);
  });
});

describe('withMindSubtrees', () => {
  it('carries the whole branch under a dragged node', () => {
    const els: Element[] = [node('r'), node('a', 'r'), node('a1', 'a'), node('b', 'r')];
    expect([...withMindSubtrees(els, new Set(['a']))].sort()).toEqual(['a', 'a1']);
  });

  it('leaves non-mind selections alone', () => {
    const sq = createShape('square', 0, 0);
    expect([...withMindSubtrees([sq], new Set([sq.id]))]).toEqual([sq.id]);
  });
});
