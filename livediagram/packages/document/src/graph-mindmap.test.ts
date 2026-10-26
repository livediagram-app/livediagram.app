import { describe, expect, it } from 'vitest';
import { layoutGraph } from './graph-input';

// docs/specs/015-api/mcp-server.md §4.7 `style: "mindmap"`: the tree hangs off the root along the edges; a part no edge
// joins to the root hangs off it by its own first node and keeps its own edges as the tree's.
describe('mindmap style', () => {
  it('keeps a second part of the graph a branch of its own, not dashed links across the map', () => {
    const els = layoutGraph({
      style: 'mindmap',
      nodes: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, label: id.toUpperCase() })),
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'd', to: 'e' },
        { from: 'e', to: 'f' },
      ],
    });
    const parent = (id: string) =>
      (els.find((e) => e.id === id) as { mindParentId?: string } | undefined)?.mindParentId;
    expect(parent('d')).toBe('a');
    expect(parent('e')).toBe('d');
    expect(parent('f')).toBe('e');
    // Every edge is a tree edge: nothing is drawn as a dashed cross-link.
    const dashed = els.filter(
      (e) => e.type === 'arrow' && 'strokeStyle' in e && e.strokeStyle === 'dashed',
    );
    expect(dashed).toEqual([]);
  });
});
