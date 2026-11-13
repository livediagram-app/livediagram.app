import { describe, expect, it } from 'vitest';
import type { Element } from './element';
import { dropMalformedFlowchartIds, dropMalformedIds, ELEMENT_KEY_MAX } from './malformed-ids';

// Catalogue keys are text (each product's technology-icons spec, "iconId stays a plain string").
const shape = (fields: Record<string, unknown>) =>
  ({ id: 'a', type: 'shape', shape: 'icon', x: 0, y: 0, width: 1, height: 1, ...fields }) as unknown as Element;

describe('dropMalformedIds', () => {
  it('keeps text keys and hands the same array back', () => {
    const els = [shape({ iconId: 'emoji-rocket', stickerId: 'star', flowchartId: 7 })];
    expect(dropMalformedIds(els)).toBe(els);
  });

  it('drops a key that is not one, and copies only what it changes', () => {
    const good = shape({ iconId: 'x' });
    const els = [good, shape({ iconId: 5 }), shape({ stickerId: 'x'.repeat(ELEMENT_KEY_MAX + 1) })];
    const [kept, a, b] = dropMalformedIds(els);
    expect(kept).toBe(good);
    expect(a).not.toHaveProperty('iconId');
    expect(b).not.toHaveProperty('stickerId');
  });

  it("also drops a flowchart step's malformed key in a product with flowcharts", () => {
    const els = [shape({ flowchartId: [1] }), shape({ flowchartId: 'chart-1' })];
    const [bad, good] = dropMalformedFlowchartIds(els);
    expect(bad).not.toHaveProperty('flowchartId');
    expect(good).toHaveProperty('flowchartId', 'chart-1');
  });
});
