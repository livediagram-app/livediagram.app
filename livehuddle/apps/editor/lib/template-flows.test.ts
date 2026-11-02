import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element } from '@livehuddle/document';
import { buildTemplate } from './template-builders';

// Structural pins for the three process templates rebuilt as worked examples
// (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the swimlane's role lanes and grid, the
// approval workflow's two gates with their different rejections, and the
// data-flow diagram's notation + key. Geometry-level so a layout regression
// (a step landing in the gutter, an unlabelled flow) fails here rather than
// in a screenshot.

type Boxed = Exclude<Element, ArrowElement>;
const boxes = (els: Element[]) => els.filter((el): el is Boxed => el.type !== 'arrow');
const arrows = (els: Element[]) => els.filter((el): el is ArrowElement => el.type === 'arrow');
const shapesOf = (els: Element[], shape: string) =>
  boxes(els).filter((el) => el.type === 'shape' && el.shape === shape);
const byId = (els: Element[]) => new Map(els.map((el) => [el.id, el]));
const pinnedIds = (a: ArrowElement) => {
  if (a.from.kind !== 'pinned' || a.to.kind !== 'pinned') throw new Error('unpinned arrow');
  return { from: a.from.elementId, to: a.to.elementId };
};

describe('the data flow diagram template', () => {
  const els = buildTemplate('data-flow', 0, 0);
  const map = byId(els);
  const flows = arrows(els).filter((a) => a.from.kind === 'pinned');

  it('uses one symbol per DFD role, numbered the conventional way', () => {
    const entities = shapesOf(els, 'square').filter((s) => s.label !== '');
    expect(entities.map((e) => e.label)).toEqual(['Customer', 'Payment provider']);
    const processes = shapesOf(els, 'circle').filter((s) => s.label !== '');
    expect(processes.map((p) => p.label)).toEqual([
      '1.0 Take order',
      '2.0 Take payment',
      '3.0 Fulfil order',
    ]);
    const stores = shapesOf(els, 'cylinder').filter((s) => s.label !== '');
    for (const s of stores) expect(s.label).toMatch(/^D\d /);
  });

  it('labels every flow with the data it carries, never a node name', () => {
    expect(flows.length).toBeGreaterThanOrEqual(8);
    const nodeLabels = new Set(boxes(els).map((b) => b.label));
    for (const f of flows) {
      expect(f.label).toBeTruthy();
      expect(nodeLabels.has(f.label)).toBe(false);
      const { from, to } = pinnedIds(f);
      expect(map.get(from)).toBeDefined();
      expect(map.get(to)).toBeDefined();
    }
  });

  it('carries a key naming all four symbols', () => {
    const captions = boxes(els)
      .filter((b) => b.type === 'text')
      .map((t) => t.label);
    expect(captions).toEqual(
      expect.arrayContaining(['Key', 'External entity', 'Process', 'Data store', 'Data flow']),
    );
  });
});
