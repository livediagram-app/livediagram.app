import { describe, it, expect } from 'vitest';
import { parseMermaid, mermaidFromTab } from './mermaid';
import { graphToElements } from './graph-authoring';
import { autoLayoutElements } from './auto-layout';
import { layoutClusteredGraph } from './auto-layout-clusters';
import { isValidTab } from './validate';
import type { Element } from './index';

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

  it('skips decoration lines (classDef / style / comments)', () => {
    const r = parseMermaid(`flowchart TD
  %% a comment
  A --> B
  classDef big fill:#f00
  style A stroke:#333
  linkStyle 0 stroke:#0f0
  click A callback`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.edges).toEqual([{ from: 'A', to: 'B' }]);
  });

  it('maps edge operators onto stroke / ends / head fields', () => {
    const r = parseMermaid(`flowchart TD
  A --- B
  B -.-> C
  C ==> D
  D <--> E
  E --o F
  F --x G
  G ---> H`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.edges).toEqual([
      { from: 'A', to: 'B', ends: 'none' },
      { from: 'B', to: 'C', line: 'dashed' },
      { from: 'C', to: 'D', line: 'thick' },
      { from: 'D', to: 'E', ends: 'both' },
      { from: 'E', to: 'F', head: 'circle' },
      { from: 'F', to: 'G', head: 'cross' },
      { from: 'G', to: 'H' },
    ]);
  });

  it('reads inline `-- text -->` labels in all three stroke forms', () => {
    const r = parseMermaid(`flowchart TD
  A -- yes --> B
  B -. maybe .-> C
  C == no ==> D`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.edges).toEqual([
      { from: 'A', to: 'B', label: 'yes' },
      { from: 'B', to: 'C', label: 'maybe', line: 'dashed' },
      { from: 'C', to: 'D', label: 'no', line: 'thick' },
    ]);
  });

  it('fans `A & B --> C & D` into the cartesian product', () => {
    const r = parseMermaid('flowchart TD\n  A & B --> C & D');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.edges).toEqual([
      { from: 'A', to: 'C' },
      { from: 'A', to: 'D' },
      { from: 'B', to: 'C' },
      { from: 'B', to: 'D' },
    ]);
  });

  it('parses invisible ~~~ links but drops the edge (nodes survive)', () => {
    const r = parseMermaid('flowchart TD\n  A ~~~ B\n  A --> C');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C']);
    expect(r.graph.edges).toEqual([{ from: 'A', to: 'C' }]);
  });

  it('reads the extended shape brackets', () => {
    const r = parseMermaid(`flowchart TD
  A[[Sub]] --> B>Flag]
  B --> C(((Double)))
  C --> D[/Trap\\]
  D --> E[\\PadT/]
  E --> F[/Lean/]`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byId = Object.fromEntries(r.graph.nodes.map((n) => [n.id, n]));
    expect(byId.A).toMatchObject({ label: 'Sub', shape: 'square' });
    expect(byId.B).toMatchObject({ label: 'Flag', shape: 'square' });
    expect(byId.C).toMatchObject({ label: 'Double', shape: 'circle' });
    expect(byId.D).toMatchObject({ label: 'Trap', shape: 'trapezoid' });
    expect(byId.E).toMatchObject({ label: 'PadT', shape: 'trapezoid' });
    expect(byId.F).toMatchObject({ label: 'Lean', shape: 'parallelogram' });
  });

  it('reads the @{ shape, label } attribute form', () => {
    const r = parseMermaid(`flowchart TD
  A@{ shape: cyl, label: "Store" } --> B@{ shape: doc }`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byId = Object.fromEntries(r.graph.nodes.map((n) => [n.id, n]));
    expect(byId.A).toMatchObject({ label: 'Store', shape: 'cylinder' });
    expect(byId.B).toMatchObject({ label: 'B', shape: 'document' });
  });

  it('decodes <br/> and entities in labels', () => {
    const r = parseMermaid('flowchart TD\n  A["Line 1<br/>Line 2 &quot;q&quot; &amp; more"] --> B');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.nodes[0]!.label).toBe('Line 1\nLine 2 "q" & more');
  });

  it('collects top-level subgraphs as clusters (id[title] and bare forms)', () => {
    const r = parseMermaid(`flowchart TD
  subgraph s1["Payments"]
    A --> B
  end
  subgraph backend
    C
  end
  B --> C`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.clusters).toEqual([
      { id: 's1', label: 'Payments', members: ['A', 'B'] },
      { id: 'backend', label: 'backend', members: ['C'] },
    ]);
    expect(r.graph.edges).toHaveLength(2);
  });

  it('folds nested subgraphs into their top-level ancestor', () => {
    const r = parseMermaid(`flowchart TD
  subgraph outer
    A
    subgraph inner
      B
    end
    C
  end
  A --> B`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.clusters).toEqual([{ id: 'outer', label: 'outer', members: ['A', 'B', 'C'] }]);
  });

  it('lets an edge reference a subgraph id without minting a node for it', () => {
    const r = parseMermaid(`flowchart TD
  subgraph s1["Group"]
    A
  end
  B --> s1`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.nodes.map((n) => n.id)).toEqual(['A', 'B']);
    expect(r.graph.edges).toEqual([{ from: 'B', to: 's1' }]);
    expect(r.graph.clusters).toEqual([{ id: 's1', label: 'Group', members: ['A'] }]);
  });

  it('tolerates a bare header and trailing semicolons', () => {
    const r = parseMermaid('flowchart\n  A --> B;');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.direction).toBe('TB');
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

  it('spells edge operators from the arrow stroke / ends / head fields', () => {
    const els = graphToElements(
      {
        nodes: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, label: id.toUpperCase() })),
        edges: [
          { from: 'a', to: 'b', line: 'dashed' },
          { from: 'b', to: 'c', line: 'thick' },
          { from: 'c', to: 'd', ends: 'none' },
          { from: 'd', to: 'e', ends: 'both' },
          { from: 'a', to: 'e', head: 'circle' },
        ],
      },
      (() => {
        let i = 0;
        return () => `edge-${++i}`;
      })(),
    );
    const out = mermaidFromTab({ elements: els });
    expect(out).toContain('n1 -.-> n2');
    expect(out).toContain('n2 ==> n3');
    expect(out).toContain('n3 --- n4');
    expect(out).toContain('n4 <--> n5');
    expect(out).toContain('n1 --o n5');
  });

  it('exports a head-at-from arrow with its endpoints swapped', () => {
    const els = graphToElements({
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b', ends: 'from' }],
    });
    expect(mermaidFromTab({ elements: els })).toContain('n2 --> n1');
  });

  it('exports frames as subgraph blocks around the nodes they contain', () => {
    const els: Element[] = [
      {
        id: 'f',
        type: 'shape',
        shape: 'frame',
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        label: 'Group',
      },
      {
        id: 'in',
        type: 'shape',
        shape: 'square',
        x: 100,
        y: 100,
        width: 120,
        height: 120,
        label: 'In',
      },
      {
        id: 'out',
        type: 'shape',
        shape: 'square',
        x: 600,
        y: 0,
        width: 120,
        height: 120,
        label: 'Out',
      },
      {
        id: 'a1',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 'in', anchor: 'e' },
        to: { kind: 'pinned', elementId: 'out', anchor: 'w' },
      },
      {
        id: 'a2',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 'out', anchor: 'w' },
        to: { kind: 'pinned', elementId: 'f', anchor: 'e' },
      },
    ];
    const out = mermaidFromTab({ elements: els });
    expect(out).toContain('subgraph s1["Group"]');
    expect(out).toContain('subgraph s1["Group"]\n    n1["In"]\n  end');
    expect(out).toContain('n2["Out"]');
    expect(out).toContain('n1 --> n2');
    expect(out).toContain('n2 --> s1');
  });

  it('escapes newlines and quotes so labels round-trip', () => {
    const els = graphToElements({
      nodes: [{ id: 'a', label: 'Line 1\nSay "hi"' }],
      edges: [],
    });
    const out = mermaidFromTab({ elements: els });
    expect(out).toContain('n1["Line 1<br/>Say &quot;hi&quot;"]');
    const back = parseMermaid(`flowchart TD\n  ${'n1["Line 1<br/>Say &quot;hi&quot;"]'}`);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.graph.nodes[0]!.label).toBe('Line 1\nSay "hi"');
  });

  it('round-trips a clustered, styled flowchart through layout and back', () => {
    const src = `flowchart LR
  subgraph s1["Backend"]
    A[Api] -.-> B[(Db)]
  end
  C([Client]) ==> A
  C --- s1`;
    const parsed = parseMermaid(src);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const els = layoutClusteredGraph(parsed.graph, { direction: parsed.direction });
    const back = parseMermaid(mermaidFromTab({ elements: els }));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.graph.clusters).toHaveLength(1);
    expect(back.graph.clusters![0]!.members).toHaveLength(2);
    const labels = Object.fromEntries(back.graph.nodes.map((n) => [n.label, n.shape]));
    expect(labels).toMatchObject({ Api: 'square', Db: 'cylinder', Client: 'stadium' });
    expect(back.graph.edges).toHaveLength(3);
    expect(back.graph.edges.find((e) => e.line === 'dashed')).toBeTruthy();
    expect(back.graph.edges.find((e) => e.line === 'thick')).toBeTruthy();
    expect(back.graph.edges.find((e) => e.ends === 'none')).toBeTruthy();
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
