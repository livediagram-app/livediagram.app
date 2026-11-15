import { describe, expect, it } from 'vitest';
import { startsAtExactAnchor } from './exact-start';
import { createShape } from './testing/elements';
import { createFlowchartStart, planFlowchartStep } from './testing/flowchart';
import { MIND_GROW, MIND_MAP } from './testing/mind';
import type { Element, ShapeElement } from './element';

// docs/specs/008-canvas/arrow-anchors.md "In mind maps and flowcharts it is on by default".

const mindNode = (id: string, parent?: string): ShapeElement => ({
  ...createShape('mind-node', 0, 0),
  id,
  width: 200,
  height: 60,
  ...(parent ? { mindParentId: parent } : {}),
});
const step = (): ShapeElement => ({
  ...createFlowchartStart(0, 0),
  id: 'start',
  flowchartId: 'start',
});
const square = (): ShapeElement => ({ ...createShape('square', 0, 0), id: 'sq' });

describe('startsAtExactAnchor', () => {
  it('is true for a mind node and a flowchart step, false for anything else', () => {
    expect(startsAtExactAnchor(mindNode('m'))).toBe(true);
    expect(startsAtExactAnchor(step())).toBe(true);
    expect(startsAtExactAnchor(square())).toBe(false);
    // A flowchart kind that belongs to no chart is a plain shape.
    const { flowchartId: _chart, ...loose } = createFlowchartStart(0, 0);
    expect(startsAtExactAnchor(loose)).toBe(false);
    expect(startsAtExactAnchor(undefined)).toBe(false);
    expect(startsAtExactAnchor(null)).toBe(false);
  });
});

describe('new mind and flowchart connectors start at the exact anchor', () => {
  it("a mind map's grown child and sibling", () => {
    const els: Element[] = [mindNode('r'), mindNode('c', 'r')];
    const ids = { node: 'n', arrow: 'a' };
    expect(MIND_GROW.planMindGrowth(els, 'r', 'child', ids)!.arrow!.exactStart).toBe(true);
    expect(MIND_GROW.planMindGrowth(els, 'c', 'sibling', ids)!.arrow!.exactStart).toBe(true);
  });

  it("the mind map's own child and sibling growth", () => {
    const r = mindNode('r');
    const c = mindNode('c', 'r');
    expect(MIND_MAP.growMindChild([r], r).arrow.exactStart).toBe(true);
    expect(MIND_MAP.growMindSibling([r, c], c).arrow!.exactStart).toBe(true);
  });

  it("a flowchart's added step", () => {
    const plan = planFlowchartStep([step()], 'start', 'next', { step: 's2', connector: 'c2' })!;
    expect(plan.connector.exactStart).toBe(true);
  });
});
