import { describe, expect, it } from 'vitest';
import { graphFromMermaid, layoutGraph } from './graph-input';
import { arrowPolyline, pathPassesThrough } from './arrow-path-hits';
import { elementIndexFor } from './geometry';
import { isBoxed, type ArrowElement, type BoxedElement, type Element } from './index';

// docs/specs/020-import-export/mermaid.md "Layout": the editor's import lays Mermaid out as an agent's Mermaid is
// laid out, its labels kept whole.

const CAFE = `flowchart LR
  A[Café ☕ order] --> B{Paid?}
  B -- yes --> C[Brew]
  B -. no .-> D[(Orders DB)]
  subgraph Kitchen
    C --> E((Serve))
  end
  E --> A`;

const imported = (text: string): Element[] => {
  const read = graphFromMermaid(text);
  if (!read.ok) throw new Error(read.error);
  return layoutGraph(read.graph, { wholeLabels: true });
};
const byId = (els: Element[], id: string) => els.find((e) => e.id === id) as BoxedElement;
const inside = (inner: BoxedElement, outer: BoxedElement) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe('a Mermaid import', () => {
  it('draws no line through a box it does not join, a line back to an earlier step included', () => {
    const els = imported(CAFE);
    const index = elementIndexFor(els);
    const boxes = els.filter(isBoxed).filter((b) => b.type !== 'shape' || b.shape !== 'frame');
    const arrows = els.filter((e): e is ArrowElement => e.type === 'arrow');
    expect(arrows).toHaveLength(5);
    for (const a of arrows) {
      const ends = new Set(
        [a.from, a.to].map((end) => (end.kind === 'pinned' ? end.elementId : '')),
      );
      const path = arrowPolyline(a, index);
      for (const b of boxes) if (!ends.has(b.id)) expect(pathPassesThrough(path, b)).toBe(false);
    }
  });

  it('puts a node used inside a subgraph in its frame, and starts a loop where it was written', () => {
    const els = imported(CAFE);
    const kitchen = byId(els, 'Kitchen');
    expect(inside(byId(els, 'C'), kitchen)).toBe(true);
    expect(inside(byId(els, 'E'), kitchen)).toBe(true);
    // Left to right, the order starts at A, as the Mermaid does; the group no longer took the first rank.
    expect(byId(els, 'A').x).toBeLessThan(byId(els, 'B').x);
    expect(byId(els, 'B').x).toBeLessThan(kitchen.x);
  });

  it('keeps a long label whole, where an agent gets a heading', () => {
    const long = 'Validate the order against the stock levels held by the warehouse service';
    const text = `flowchart TD\n  A[${long}] --> B[Ship]`;
    const label = (els: Element[]) => byId(els, 'A').label ?? '';
    expect(label(imported(text))).toBe(long);
    const read = graphFromMermaid(text);
    if (!read.ok) throw new Error(read.error);
    expect(label(layoutGraph(read.graph)).length).toBeLessThan(long.length);
  });
});
