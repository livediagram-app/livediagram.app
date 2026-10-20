import { describe, expect, it } from 'vitest';
import { angledCornerPoints } from './arrow-path';
import { anchorPosition } from './geometry';
import { graphFromMermaid, layoutGraph } from './graph-input';
import { SELF_LOOP_REACH } from './graph-self-loops';
import { isBoxed, type ArrowElement, type BoxedElement, type Element } from './index';

// docs/specs/020-import-export/mermaid.md "Self-loops": an edge from a node to itself loops off the node's top-right
// corner, never straight through the node.
const laid = (text: string): Element[] => {
  const read = graphFromMermaid(text);
  if (!read.ok) throw new Error(read.error);
  return layoutGraph(read.graph, { wholeLabels: true });
};

const selfLoops = (els: Element[]) =>
  els.filter(
    (el): el is ArrowElement =>
      el.type === 'arrow' &&
      el.from.kind === 'pinned' &&
      el.to.kind === 'pinned' &&
      el.from.elementId === el.to.elementId,
  );

const inside = (p: { x: number; y: number }, b: BoxedElement) =>
  p.x > b.x + 1 && p.x < b.x + b.width - 1 && p.y > b.y + 1 && p.y < b.y + b.height - 1;

describe('self-loops', () => {
  it.each([
    'flowchart TD\n  A[Start] --> B{Decide?}\n  B --> B\n  B --> C[End]',
    'flowchart LR\n  A --> B\n  B -->|again| B',
    'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Idle : tick\n  Idle --> Busy',
  ])('loop round the outside of their node: %s', (text) => {
    const els = laid(text);
    const loops = selfLoops(els);
    expect(loops).toHaveLength(1);
    const loop = loops[0]!;
    const box = els.find(
      (el) => isBoxed(el) && el.id === (loop.from.kind === 'pinned' && loop.from.elementId),
    ) as BoxedElement;
    expect(loop.arrowStyle).toBe('angled');
    expect(loop.from).toMatchObject({ anchor: 'e' });
    expect(loop.to).toMatchObject({ anchor: 'n' });
    const from = anchorPosition(box, 'e');
    const to = anchorPosition(box, 'n');
    const corners = angledCornerPoints(from, to, loop.curvePoints!, loop.from, loop.to);
    expect(corners).toHaveLength(3);
    for (const c of corners) expect(inside(c, box), JSON.stringify(c)).toBe(false);
    // Clear of the box by the reach, right of it and above it.
    expect(corners[0]!.x).toBeCloseTo(box.x + box.width + SELF_LOOP_REACH, 0);
    expect(corners[1]!.y).toBeCloseTo(box.y - SELF_LOOP_REACH, 0);
  });

  it('leaves every other edge as the layout drew it', () => {
    const text = 'flowchart TD\n  A --> B\n  B --> C';
    const read = graphFromMermaid(text);
    if (!read.ok) throw new Error(read.error);
    expect(selfLoops(laid(text))).toHaveLength(0);
  });
});
