import { describe, expect, it } from 'vitest';
import {
  applyMindMoves,
  elementIndexFor,
  endpointPosition,
  planMindGrowth,
  type Element,
  type ShapeElement,
} from '@livepages/document';
import { buildMindMap } from './template-builders-mindmaps';

// docs/specs/009-elements/mind-node.md "Connectors": a bubble map's spokes leave each node toward the other's
// centre and run straight, so growing a branch never routes a spoke behind a sibling (issue #970's repro:
// Travel grows Hotel, then Taxi).

const isNode = (el: Element): el is ShapeElement => el.type === 'shape' && el.shape === 'mind-node';

function grow(
  elements: Element[],
  fromId: string,
  kind: 'child' | 'sibling',
  id: string,
): Element[] {
  const plan = planMindGrowth(elements, fromId, kind, { node: id, arrow: `${id}-arrow` });
  if (!plan) throw new Error(`no growth from ${fromId}`);
  const moved = applyMindMoves(elements, plan.moves, plan.reanchored);
  return [...moved, { ...plan.node, label: id }, ...(plan.arrow ? [plan.arrow] : [])];
}

// Whether the segment a-b passes through the rectangle (shrunk by a pixel, so touching an edge is not a cross).
function crosses(
  a: { x: number; y: number },
  b: { x: number; y: number },
  r: ShapeElement,
): boolean {
  const x0 = r.x + 1;
  const y0 = r.y + 1;
  const x1 = r.x + r.width - 1;
  const y1 = r.y + r.height - 1;
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const [p, q] of [
    [-dx, a.x - x0],
    [dx, x1 - a.x],
    [-dy, a.y - y0],
    [dy, y1 - a.y],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

function crossings(elements: Element[]): string[] {
  const index = elementIndexFor(elements);
  const nodes = elements.filter(isNode);
  const out: string[] = [];
  for (const el of elements) {
    if (el.type !== 'arrow' || el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
    const { from, to } = el;
    if (from.kind !== 'pinned' || to.kind !== 'pinned') continue;
    const a = endpointPosition(from, index);
    const b = endpointPosition(to, index);
    for (const n of nodes) {
      if (n.id === from.elementId || n.id === to.elementId) continue;
      if (crosses(a, b, n))
        out.push(
          `${index.get(from.elementId)?.label} -> ${index.get(to.elementId)?.label} crosses ${n.label}`,
        );
    }
  }
  return out;
}

describe('bubble mind map spokes', () => {
  it('clear every sibling after Travel grows Hotel and Taxi', () => {
    let map = buildMindMap(0, 0);
    const travel = map.find((el) => isNode(el) && el.label === 'Travel')!;
    map = grow(map, travel.id, 'child', 'Hotel');
    map = grow(map, 'Hotel', 'sibling', 'Taxi');
    expect(crossings(map)).toEqual([]);
  });

  it('clear every node on the template as built', () => {
    expect(crossings(buildMindMap(0, 0))).toEqual([]);
  });
});
