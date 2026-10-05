import { describe, it, expect } from 'vitest';
import { parseMermaid, mermaidFromTab, startsWithMermaidHeader } from './mermaid';
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

  it('imports click href lines as node URL links (callback form skipped)', () => {
    const r = parseMermaid(`flowchart TD
  A[Docs] --> B[App]
  click A "https://example.com/docs"
  click B href "https://example.com/app" "tooltip"
  click B someJsCallback`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byId = Object.fromEntries(r.graph.nodes.map((n) => [n.id, n]));
    expect(byId.A!.link).toBe('https://example.com/docs');
    expect(byId.B!.link).toBe('https://example.com/app');
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

  it('emits click lines for URL element links, and they round-trip', () => {
    const els = graphToElements({
      nodes: [
        { id: 'a', label: 'Docs', link: 'https://example.com/docs' },
        { id: 'b', label: 'Plain' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });
    const out = mermaidFromTab({ elements: els });
    expect(out).toContain('click n1 "https://example.com/docs"');
    expect(out).not.toContain('click n2');
    const back = parseMermaid(out);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.graph.nodes.find((n) => n.label === 'Docs')!.link).toBe('https://example.com/docs');
  });

  it('round-trips a label containing the shape’s own closing bracket', () => {
    // The reader used to find the close bracket with a bare indexOf, so on
    // `n1["Array[0]"]` — which is valid Mermaid and exactly what we export —
    // it stopped at the `]` INSIDE the label. That gave the label `"Array[0`
    // (unbalanced, so the quotes couldn't be stripped) and left `"]` behind to
    // be discarded. Our own export didn't survive our own import.
    const out = mermaidFromTab({
      elements: graphToElements({ nodes: [{ id: 'a', label: 'Array[0]' }], edges: [] }),
    });
    expect(out).toContain('n1["Array[0]"]');
    const back = parseMermaid(out);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.graph.nodes[0]!.label).toBe('Array[0]');
  });

  it('keeps the shape when a bracket in the label sits inside a multi-char pair', () => {
    // The follow-on trap. A stadium is `(["…"])`, so the plain `(`/`)` pair
    // also matches its opening — and on `(["Retry (3)"])` that pair's closer
    // is the `)` inside the label, at a LOWER index than the stadium's real
    // one. The earliest-closer tie-break therefore preferred it, and a
    // stadium came back as a rounded box labelled `["Retry (3`. A quoted
    // label delimits itself, so it now outranks any positional guess.
    for (const [label, shape] of [
      ['Retry (3)', 'stadium'],
      ['circ (c)', 'circle'],
      ['hex {h}', 'hexagon'],
      ['tr [z]', 'trapezoid'],
      ['par [/x/]', 'parallelogram'],
    ] as const) {
      const out = mermaidFromTab({
        elements: graphToElements({ nodes: [{ id: 'a', label, shape }], edges: [] }),
      });
      const back = parseMermaid(out);
      expect(back.ok, `${shape} did not parse: ${out}`).toBe(true);
      if (!back.ok) return;
      expect([back.graph.nodes[0]!.label, back.graph.nodes[0]!.shape]).toEqual([label, shape]);
    }
  });

  it('still reads unquoted labels, which third-party Mermaid usually has', () => {
    // The quoted path must not become the only path: hand-written Mermaid
    // rarely quotes, and those labels can't contain a bracket anyway.
    const back = parseMermaid('flowchart TD\n  a[Start] --> b{Ok?}\n  b -->|yes| c([Done])');
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.graph.nodes.map((n) => [n.label, n.shape])).toEqual([
      ['Start', 'square'],
      ['Ok?', 'diamond'],
      ['Done', 'stadium'],
    ]);
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

  it('round-trips an edge label containing the pipe that delimits it', () => {
    const els = graphToElements({
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b', label: 'yes|no' }],
    });
    const back = parseMermaid(mermaidFromTab({ elements: els }));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.graph.nodes).toHaveLength(2);
    expect(back.graph.edges.map((e) => e.label)).toEqual(['yes|no']);
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

describe('mermaidFromTab frame membership', () => {
  const shape = (
    id: string,
    kind: string,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
  ) => ({ id, type: 'shape', shape: kind, x, y, width: w, height: h, label }) as Element;

  it('puts a node in the smallest frame holding its centre, the earlier on a tie, edges inclusive', () => {
    const text = mermaidFromTab({
      elements: [
        shape('outer', 'frame', 0, 0, 1000, 1000, 'Outer'),
        shape('inner', 'frame', 0, 0, 200, 200, 'Inner'),
        shape('twin', 'frame', 0, 0, 200, 200, 'Twin'),
        shape('a', 'square', 50, 50, 20, 20, 'A'),
        shape('edge', 'square', 190, 190, 20, 20, 'On the edge'),
        shape('big', 'square', -400, -400, 1200, 1200, 'Bigger than its frame'),
        shape('out', 'square', 2000, 0, 20, 20, 'Outside'),
      ],
    });
    expect(text).toBe(
      [
        'flowchart TD',
        '  subgraph s1["Outer"]',
        '  end',
        '  subgraph s2["Inner"]',
        '    n1["A"]',
        '    n2["On the edge"]',
        '    n3["Bigger than its frame"]',
        '  end',
        '  subgraph s3["Twin"]',
        '  end',
        '  n4["Outside"]',
        '',
      ].join('\n'),
    );
  });
});

describe('mermaidFromTab fallbacks and line forms', () => {
  const node = (id: string, extra: Record<string, unknown> = {}) =>
    ({
      id,
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      ...extra,
    }) as Element;
  const arrow = (id: string, from: string, to: string, extra: Record<string, unknown> = {}) =>
    ({
      id,
      type: 'arrow',
      from: { kind: 'pinned', elementId: from, anchor: 'e' },
      to: { kind: 'pinned', elementId: to, anchor: 'w' },
      ...extra,
    }) as Element;

  it('names unlabelled nodes and frames by their ids and boxes an unknown shape', () => {
    const text = mermaidFromTab({
      elements: [
        node('a', { label: '  ' }),
        node('b', { shape: 'blob', label: 'Blob' }),
        node('c', { shape: undefined, label: 'No kind' }),
        node('d'),
        node('f', { shape: 'frame', x: 500, width: 100, height: 100 }),
      ],
    });
    expect(text).toBe(
      [
        'flowchart TD',
        '  subgraph s1["s1"]',
        '  end',
        '  n1["n1"]',
        '  n2["Blob"]',
        '  n3["No kind"]',
        '  n4["n4"]',
        '',
      ].join('\n'),
    );
  });

  it('spells undirected dashed and thick lines, circle heads, and skips free ends', () => {
    const text = mermaidFromTab({
      elements: [
        node('a', { label: 'A' }),
        node('b', { label: 'B' }),
        arrow('dashed', 'a', 'b', { arrowEnds: 'none', strokeStyle: 'dashed' }),
        arrow('thick', 'a', 'b', { arrowEnds: 'none', strokeWidth: 99 }),
        arrow('circles', 'a', 'b', { arrowEnds: 'both', arrowheadShape: 'circle' }),
        {
          id: 'free',
          type: 'arrow',
          from: { kind: 'free', x: 0, y: 0 },
          to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
        } as Element,
        arrow('to-nowhere', 'a', 'gone'),
        arrow('free-head', 'a', 'b', { to: { kind: 'free', x: 9, y: 9 } }),
      ],
    });
    expect(text.split('\n').slice(3, -1)).toEqual(['  n1 -.- n2', '  n1 === n2', '  n1 o--o n2']);
  });
});

describe('startsWithMermaidHeader', () => {
  it('reads the first meaningful line as a header the importer accepts', () => {
    expect(startsWithMermaidHeader('%% comment\n\nflowchart LR\n  a --> b')).toBe(true);
    expect(startsWithMermaidHeader('graph TD\na-->b')).toBe(true);
    expect(startsWithMermaidHeader('stateDiagram-v2\n[*] --> A')).toBe(true);
    expect(startsWithMermaidHeader('erDiagram\nA ||--o{ B : has')).toBe(true);
  });

  it('is false for edit operations, an unsupported dialect and nothing at all', () => {
    expect(startsWithMermaidHeader('add square id=web label=Web\nconnect web -> api')).toBe(false);
    expect(startsWithMermaidHeader('sequenceDiagram\nA->>B: hi')).toBe(false);
    expect(startsWithMermaidHeader('\n  \n')).toBe(false);
  });
});
