import { describe, expect, it } from 'vitest';
import { layoutGraph } from './graph-input';
import { isBoxed, type Element } from './index';

// docs/specs/015-api/mcp-server.md §4.7 "Self-edges": a mind map and a ring have no place for an edge from a node to
// itself. The node shows; the self-edge is dropped, as if never given. The flow style draws it as a loop.
type Pinned = { kind: 'pinned'; elementId: string };
const arrows = (els: Element[]) =>
  els.filter((el): el is Extract<Element, { type: 'arrow' }> => el.type === 'arrow');
const selfArrows = (els: Element[]) =>
  arrows(els).filter(
    (a) =>
      a.from.kind === 'pinned' &&
      a.to.kind === 'pinned' &&
      (a.from as Pinned).elementId === (a.to as Pinned).elementId,
  );

describe('self-edges', () => {
  const nodes = ['a', 'b', 'c'].map((id) => ({ id, label: id.toUpperCase() }));
  const edges = [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
    { from: 'b', to: 'b' },
  ];

  it.each(['flow', 'tree'] as const)('keeps a self-edge as a loop in the %s style', (style) => {
    const els = layoutGraph({ style, nodes, edges });
    expect(selfArrows(els)).toHaveLength(1);
  });

  it('keeps a self-edge as a loop in the lanes style', () => {
    const els = layoutGraph({
      style: 'lanes',
      nodes: nodes.map((n) => ({ ...n, group: 'Lane' })),
      edges,
    });
    expect(selfArrows(els)).toHaveLength(1);
  });

  it.each(['mindmap', 'cycle'] as const)(
    'shows the node and drops its self-edge in the %s style',
    (style) => {
      const els = layoutGraph({ style, nodes, edges });
      expect(els.filter(isBoxed).map((b) => b.id)).toEqual(expect.arrayContaining(['a', 'b', 'c']));
      expect(selfArrows(els)).toEqual([]);
      expect(arrows(els)).toHaveLength(2);
    },
  );

  it('puts a cycle node whose only edge is a self-edge at the centre, as a node with no edge', () => {
    const els = layoutGraph({
      style: 'cycle',
      nodes: [...nodes, { id: 'hub', label: 'Hub' }],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
        { from: 'hub', to: 'hub' },
      ],
    }).filter(isBoxed);
    const hub = els.find((b) => b.id === 'hub')!;
    expect(Math.abs(hub.x + hub.width / 2)).toBeLessThan(1);
    expect(Math.abs(hub.y + hub.height / 2)).toBeLessThan(1);
  });
});
