import { describe, it, expect } from 'vitest';
import { parseMermaid, mermaidFromTab } from './mermaid';
import { graphToElements } from './graph-authoring';
import { autoLayoutElements } from './auto-layout';
import { isValidTab } from './validate';

describe('parseMermaid', () => {
  it('parses a basic top-down flowchart with shapes and edge labels', () => {
    const r = parseMermaid(`flowchart TD
  A([Start]) --> B{OK?}
  B -->|yes| C[Ship]
  B -->|no| D[(Log)]`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.direction).toBe('TB');
    const byId = Object.fromEntries(r.graph.nodes.map((n) => [n.id, n]));
    expect(byId.A).toMatchObject({ label: 'Start', shape: 'stadium' });
    expect(byId.B).toMatchObject({ label: 'OK?', shape: 'diamond' });
    expect(byId.C).toMatchObject({ label: 'Ship', shape: 'square' });
    expect(byId.D).toMatchObject({ label: 'Log', shape: 'cylinder' });
    expect(r.graph.edges).toEqual([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C', label: 'yes' },
      { from: 'B', to: 'D', label: 'no' },
    ]);
  });

  it('reads LR direction and bare (undefined) nodes', () => {
    const r = parseMermaid('graph LR\n  A --> B --> C');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.direction).toBe('LR');
    // Chained: two edges; bare nodes labelled by their id.
    expect(r.graph.edges).toEqual([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
    ]);
    expect(r.graph.nodes.map((n) => n.label)).toEqual(['A', 'B', 'C']);
  });

  it('skips decoration lines (subgraph / classDef / style / comments)', () => {
    const r = parseMermaid(`flowchart TD
  %% a comment
  subgraph one
  A --> B
  end
  classDef big fill:#f00
  style A stroke:#333`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.edges).toEqual([{ from: 'A', to: 'B' }]);
  });

  it('rejects non-flowchart diagram types', () => {
    const r = parseMermaid('sequenceDiagram\n  Alice->>Bob: hi');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/flowchart/i);
  });

  it('errors on empty / non-graph input', () => {
    expect(parseMermaid('').ok).toBe(false);
    expect(parseMermaid('just some prose').ok).toBe(false);
  });

  it('parses into a valid, laid-out tab via graphToElements', () => {
    const r = parseMermaid('flowchart TD\n A[One] --> B[Two] --> C[Three]');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const els = autoLayoutElements(graphToElements(r.graph), { direction: r.direction });
    expect(isValidTab({ id: 't', name: 'T', elements: els })).toBe(true);
  });
});

describe('mermaidFromTab', () => {
  it('serialises shapes + labelled arrows to flowchart text', () => {
    const els = graphToElements(
      {
        nodes: [
          { id: 'a', label: 'Start', shape: 'stadium' },
          { id: 'b', label: 'Choose', shape: 'diamond' },
        ],
        edges: [{ from: 'a', to: 'b', label: 'go' }],
      },
      () => 'edge-1',
    );
    const out = mermaidFromTab({ elements: els });
    expect(out).toContain('flowchart TD');
    expect(out).toMatch(/n1\(\["Start"\]\)/);
    expect(out).toMatch(/n2\{"Choose"\}/);
    expect(out).toMatch(/n1 -->\|go\| n2/);
  });

  it('round-trips: serialise then parse preserves the graph shape', () => {
    const els = graphToElements({
      nodes: [
        { id: 'x', label: 'A', shape: 'square' },
        { id: 'y', label: 'B', shape: 'circle' },
        { id: 'z', label: 'C', shape: 'cylinder' },
      ],
      edges: [
        { from: 'x', to: 'y' },
        { from: 'y', to: 'z', label: 'next' },
      ],
    });
    const text = mermaidFromTab({ elements: els });
    const r = parseMermaid(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.nodes.map((n) => [n.label, n.shape])).toEqual([
      ['A', 'square'],
      ['B', 'circle'],
      ['C', 'cylinder'],
    ]);
    expect(r.graph.edges).toHaveLength(2);
    expect(r.graph.edges[1]).toMatchObject({ label: 'next' });
  });
});
