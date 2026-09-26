import { describe, expect, it } from 'vitest';
import { createShape } from './factories';
import { SHAPE_DEFAULT_SIZE } from './shape-factory';
import type { Element, ShapeElement } from './index';
import { growMindChild, mindFlowOf } from './mind-map';
import { DEFAULT_MIND_FLOW, MIND_FLOWS, MIND_FLOW_LABEL, type MindFlow } from './mind-flow';

// The flow is the SHAPE a map grows in (docs/specs/009-elements/mind-node.md). The keystrokes are the
// same in all of them, so each test here asks only one thing: did the child
// land where that shape says it should, relative to its parent.
//
// The flow is stored on the ROOT and read for the whole tree, so a node deep
// in a bubble map grows bubbles too; that resolution is pinned as well,
// because it is the part a later refactor could quietly make per-node.

const SIZE = SHAPE_DEFAULT_SIZE['mind-node'];

const node = (id: string, x: number, y: number, parent?: string): ShapeElement => ({
  ...(createShape('mind-node', x, y) as ShapeElement),
  id,
  ...(parent ? { mindParentId: parent } : {}),
});

const root = (flow: MindFlow): ShapeElement => ({ ...node('root', 0, 0), mindFlow: flow });
const centre = (n: { x: number; y: number; width: number; height: number }) => ({
  x: n.x + n.width / 2,
  y: n.y + n.height / 2,
});

describe('mind flows', () => {
  it('labels every flow it ships', () => {
    for (const flow of MIND_FLOWS) expect(MIND_FLOW_LABEL[flow].length).toBeGreaterThan(0);
  });

  it('defaults to the arrangement growth shipped with', () => {
    // Every map drawn before flows existed has no `mindFlow`, so the default
    // has to stay 'tree' or they all re-shape themselves.
    expect(DEFAULT_MIND_FLOW).toBe('tree');
    expect(mindFlowOf([node('r', 0, 0)], node('r', 0, 0))).toBe('tree');
  });

  it('reads the flow off the ROOT, for a node anywhere in the tree', () => {
    const r = root('bubble');
    const child = node('c', 400, 0, 'root');
    const grandchild = node('g', 800, 0, 'c');
    expect(mindFlowOf([r, child, grandchild], grandchild)).toBe('bubble');
  });

  describe('tree', () => {
    it('puts the child to the right, level with the parent', () => {
      const r = root('tree');
      const { node: child } = growMindChild([r], r);
      expect(child.x).toBeGreaterThan(r.x + r.width);
      expect(centre(child).y).toBeCloseTo(centre(r).y, 5);
    });

    it('connects east to west', () => {
      const r = root('tree');
      const { arrow } = growMindChild([r], r);
      expect(arrow.from).toMatchObject({ anchor: 'e' });
      expect(arrow.to).toMatchObject({ anchor: 'w' });
    });
  });

  describe('downward', () => {
    it('puts the child below, centred on the parent', () => {
      const r = root('downward');
      const { node: child } = growMindChild([r], r);
      expect(child.y).toBeGreaterThan(r.y + r.height);
      expect(centre(child).x).toBeCloseTo(centre(r).x, 5);
    });

    it('spreads the next child ACROSS, not down', () => {
      const r = root('downward');
      const first = growMindChild([r], r).node;
      const second = growMindChild([r, first], r).node;
      expect(second.x).toBeGreaterThan(first.x + first.width);
      expect(second.y).toBe(first.y);
    });

    it('connects south to north', () => {
      const r = root('downward');
      const { arrow } = growMindChild([r], r);
      expect(arrow.from).toMatchObject({ anchor: 's' });
      expect(arrow.to).toMatchObject({ anchor: 'n' });
    });
  });

  describe('balanced', () => {
    it('throws branches both ways off the root', () => {
      const r = root('balanced');
      const first = growMindChild([r], r).node;
      const second = growMindChild([r, first], r).node;
      expect(first.x).toBeGreaterThan(r.x + r.width);
      expect(second.x + second.width).toBeLessThan(r.x);
    });

    it('keeps a branch on the side it started, deeper down', () => {
      // Flipping deeper down would fold a branch back over its own parent,
      // which is the one thing the shape exists to avoid.
      const r = root('balanced');
      const left = growMindChild([r, node('right', 400, 0, 'root')], r).node;
      const els: Element[] = [r, node('right', 400, 0, 'root'), left];
      const grandchild = growMindChild(els, left).node;
      expect(grandchild.x + grandchild.width).toBeLessThan(left.x);
    });
  });

  describe('bubble', () => {
    it('puts every child clear of the parent, at one radius', () => {
      const r = root('bubble');
      const els: Element[] = [r];
      const radii: number[] = [];
      for (let i = 0; i < 4; i++) {
        const { node: child } = growMindChild(els, r);
        els.push(child);
        radii.push(Math.hypot(centre(child).x - centre(r).x, centre(child).y - centre(r).y));
      }
      for (const radius of radii) expect(radius).toBeCloseTo(radii[0]!, 5);
    });

    it('fans siblings to different angles, so they never stack', () => {
      const r = root('bubble');
      const els: Element[] = [r];
      const seen = new Set<string>();
      for (let i = 0; i < 5; i++) {
        const { node: child } = growMindChild(els, r);
        els.push(child);
        seen.add(`${Math.round(child.x)},${Math.round(child.y)}`);
      }
      expect(seen.size).toBe(5);
    });

    it('sizes the ring off the boxes, so nothing lands on the parent', () => {
      const r = root('bubble');
      const { node: child } = growMindChild([r], r);
      const gap = Math.hypot(centre(child).x - centre(r).x, centre(child).y - centre(r).y);
      expect(gap).toBeGreaterThan(SIZE.width / 2);
    });
  });
});
