import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element } from '@livediagram/diagram';
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
const centre = (el: Boxed) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });
const inside = (p: { x: number; y: number }, el: Boxed) =>
  p.x > el.x && p.x < el.x + el.width && p.y > el.y && p.y < el.y + el.height;
const overlaps = (a: Boxed, b: Boxed) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('the swimlane template', () => {
  const els = buildTemplate('swimlane', 0, 0);
  const lanes = shapesOf(els, 'lane');
  const steps = boxes(els).filter((el) => el.type === 'shape' && el.shape !== 'lane');
  const laneOf = (el: Boxed) => lanes.findIndex((l) => inside(centre(el), l));

  it('runs across four role lanes, top to bottom', () => {
    expect(lanes.map((l) => l.label)).toEqual(['Customer', 'Sales', 'Warehouse', 'Courier']);
  });

  it('puts every step inside a lane, clear of its title gutter, with no overlaps', () => {
    for (const s of steps) {
      const lane = lanes[laneOf(s)];
      expect(lane, `${s.label} sits in no lane`).toBeDefined();
      const gutter = lane!.type === 'shape' ? (lane!.headerSize ?? 132) : 0;
      expect(s.x).toBeGreaterThan(lane!.x + gutter);
      expect(s.y).toBeGreaterThanOrEqual(lane!.y);
      expect(s.y + s.height).toBeLessThanOrEqual(lane!.y + lane!.height);
    }
    for (let i = 0; i < steps.length; i++)
      for (let j = i + 1; j < steps.length; j++)
        expect(overlaps(steps[i]!, steps[j]!), `${steps[i]!.label} / ${steps[j]!.label}`).toBe(
          false,
        );
  });

  it('pins every arrow, and lets an arrow that crosses a whole lane stay drawn over it', () => {
    const map = byId(els);
    for (const a of arrows(els)) {
      const { from, to } = pinnedIds(a);
      const span = Math.abs(laneOf(map.get(from) as Boxed) - laneOf(map.get(to) as Boxed));
      // Lanes are route-behind obstacles (docs/specs/008-canvas/arrow-route-behind.md), so an arrow
      // passing through a lane it has no endpoint in would be masked out.
      if (span > 1) expect(a.routeBehind).toBe(false);
    }
  });

  it('starts and ends in the Customer lane', () => {
    const terminators = shapesOf(els, 'stadium');
    expect(terminators.map((t) => t.label)).toEqual(['Place order', 'Order received']);
    for (const t of terminators) expect(laneOf(t)).toBe(0);
  });
});

describe('the approval workflow template', () => {
  const els = buildTemplate('approval-workflow', 0, 0);
  const map = byId(els);
  const labelOf = (id: string) => (map.get(id) as Boxed).label;

  it('groups the steps into Requester / Manager / Finance role columns', () => {
    const lanes = shapesOf(els, 'lane');
    expect(lanes.map((l) => l.label)).toEqual(['Requester', 'Manager', 'Finance']);
    for (const l of lanes) expect(l).toMatchObject({ textAlignX: 'center', textAlignY: 'top' });
  });

  it('rejects differently at each gate: rework loops back, finance declines for good', () => {
    const gates = shapesOf(els, 'diamond');
    expect(gates.map((g) => g.label)).toEqual(['Approved?', 'In budget?']);
    const noTargets = arrows(els)
      .filter((a) => a.label === 'No')
      .map((a) => labelOf(pinnedIds(a).to));
    expect(noTargets).toEqual(['Request changes', 'Declined']);
    const loop = arrows(els).find((a) => a.label === 'Revise & resubmit')!;
    expect(labelOf(pinnedIds(loop).from)).toBe('Request changes');
    expect(labelOf(pinnedIds(loop).to)).toBe('Submit request');
    // Every No drops straight down out of the bottom of its gate.
    for (const a of arrows(els).filter((x) => x.label === 'No'))
      expect(a.from).toMatchObject({ anchor: 's' });
  });
});

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
      expect(nodeLabels.has(f.label!)).toBe(false);
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
