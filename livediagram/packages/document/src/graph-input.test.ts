import { describe, expect, it } from 'vitest';
import {
  capLabel,
  conciseGraph,
  GRAPH_LABEL_MAX,
  graphFromMermaid,
  layoutGraph,
  resolveGraphInput,
} from './graph-input';

// docs/specs/015-api/mcp-server.md §4.7: labels are headings (capped, overflow into the note), the
// layout is chosen, arrows are routed, Mermaid takes the same path.

const byId = (els: ReturnType<typeof layoutGraph>, id: string) =>
  els.find((e) => e.id === id) as Record<string, unknown> & { x: number; y: number; width: number };

describe('label cap', () => {
  it('keeps a short label as it is', () => {
    expect(capLabel('Checkout service')).toEqual({ label: 'Checkout service', cut: false });
    // Line breaks written into a label that fits are kept; other runs of space become one.
    expect(capLabel('App tasks \n  ECS   Fargate\n')).toEqual({
      label: 'App tasks\nECS Fargate',
      cut: false,
    });
  });

  it('counts an emoji as one character and never cuts one in half', () => {
    const rockets = '🚀'.repeat(25);
    expect(capLabel(rockets)).toEqual({ label: rockets, cut: false });
    const { label } = capLabel('🚀'.repeat(60));
    expect(label).toBe(`${'🚀'.repeat(39)}…`);
    expect(label).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it('keeps the noun phrase before a clause as the heading', () => {
    expect(capLabel('Orders service which creates and tracks customer orders').label).toBe(
      'Orders service',
    );
    expect(capLabel('Message queue for asynchronous events between services').label).toBe(
      'Message queue',
    );
    expect(capLabel('PostgreSQL primary database holding orders and customers').label).toBe(
      'PostgreSQL primary database',
    );
  });

  it('cuts a long one with no clause at a word boundary with an ellipsis', () => {
    const { label, cut } = capLabel(
      'Payment card validation and settlement reconciliation pipeline stage',
    );
    expect(cut).toBe(true);
    expect(label.length).toBeLessThanOrEqual(GRAPH_LABEL_MAX);
    expect(label.endsWith('…')).toBe(true);
    expect(label).not.toMatch(/\s…$/);
  });

  it('moves the full text of a long label into the note, ahead of any given note', () => {
    const long = 'The payment service validates the card with the provider and records the attempt';
    const g = conciseGraph({
      nodes: [{ id: 'p', label: long, note: 'Owned by the payments team.' }],
      edges: [],
    });
    expect(g.nodes[0]!.label!.length).toBeLessThanOrEqual(GRAPH_LABEL_MAX);
    expect(g.nodes[0]!.note).toBe(`${long}\n\nOwned by the payments team.`);
  });
});

describe('layoutGraph', () => {
  const chain = {
    nodes: [
      { id: 'a', label: 'Start' },
      { id: 'b', label: 'Build' },
      { id: 'c', label: 'Ship' },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ],
  };

  it('stores a node note on the element', () => {
    const els = layoutGraph({
      ...chain,
      nodes: [{ ...chain.nodes[0]!, note: 'Kickoff' }, ...chain.nodes.slice(1)],
    });
    expect(byId(els, 'a').note).toBe('Kickoff');
  });

  it('flows right when asked, down when asked', () => {
    const right = layoutGraph({ ...chain, direction: 'right' });
    expect(byId(right, 'b').x).toBeGreaterThan(byId(right, 'a').x);
    const down = layoutGraph({ ...chain, direction: 'down' });
    expect(byId(down, 'b').y).toBeGreaterThan(byId(down, 'a').y);
  });

  it('routes arrows per style: angled for flow and tree, curved for a mind map, or as asked', () => {
    const arrows = (els: ReturnType<typeof layoutGraph>) =>
      els.filter((e) => e.type === 'arrow') as { arrowStyle?: string }[];
    // A branch, so the children sit off to each side (a lined-up angled
    // arrow has nothing to bend and runs straight).
    const branch = {
      nodes: [
        { id: 'r', label: 'Root' },
        { id: 'a', label: 'Left' },
        { id: 'b', label: 'Right' },
      ],
      edges: [
        { from: 'r', to: 'a' },
        { from: 'r', to: 'b' },
      ],
    };
    expect(arrows(layoutGraph({ ...branch, style: 'tree' }))[0]!.arrowStyle).toBe('angled');
    expect(arrows(layoutGraph({ ...branch, style: 'mindmap' }))[0]!.arrowStyle).toBe('curved');
    expect(arrows(layoutGraph(branch))[0]!.arrowStyle).toBe('angled');
    expect(arrows(layoutGraph({ ...branch, lines: 'straight' }))[0]!.arrowStyle ?? 'straight').toBe(
      'straight',
    );
    expect(arrows(layoutGraph({ ...chain, lines: 'angled' }))[0]!.arrowStyle).toBe('straight');
  });

  it('draws groups as frames around their members', () => {
    const els = layoutGraph({
      ...chain,
      groups: [{ id: 'g', label: 'Pipeline', members: ['b', 'c'] }],
    });
    const frame = els.find((e) => e.type === 'shape' && (e as { shape: string }).shape === 'frame');
    expect(frame).toBeTruthy();
    expect((frame as { label?: string }).label).toBe('Pipeline');
  });

  it('sizes a box to its label', () => {
    const els = layoutGraph({
      nodes: [
        { id: 'a', label: 'API' },
        { id: 'b', label: 'Customer notification preferences' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });
    // Peers share a size, and it fits the longest label.
    expect(byId(els, 'b').width).toBeGreaterThan(200);
  });

  it('does not cross edges it can avoid', () => {
    // Given in an order that crosses: a->d, b->c with c listed before d.
    const els = layoutGraph({
      nodes: ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id.toUpperCase() })),
      edges: [
        { from: 'a', to: 'd' },
        { from: 'b', to: 'c' },
      ],
      direction: 'down',
    });
    const ab = byId(els, 'a').x < byId(els, 'b').x;
    const dc = byId(els, 'd').x < byId(els, 'c').x;
    expect(ab).toBe(dc);
  });
});

describe('Mermaid', () => {
  it('reads a flowchart with a subgraph into the same graph', () => {
    const r = graphFromMermaid(
      'flowchart LR\n  A[Idea] --> B{Worth it?}\n  subgraph Build\n    C[Design] --> D[Ship]\n  end\n  B --> C',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.direction).toBe('right');
    expect(r.graph.groups?.[0]?.members).toEqual(['C', 'D']);
    expect(r.graph.nodes.map((n) => n.label)).toContain('Worth it?');
  });

  it('names what it supports when it cannot read a dialect', () => {
    const r = resolveGraphInput({ mermaid: 'pie\n  "A": 1' });
    expect(r.error).toMatch(/flowcharts/);
  });

  it("heads the diagram with Mermaid front matter's title", () => {
    const r = resolveGraphInput({ mermaid: '---\ntitle: Checkout\n---\nflowchart TD\n  A --> B' });
    expect(r.graph?.title).toBe('Checkout');
    expect(r.graph?.nodes.map((n) => n.id)).toEqual(['A', 'B']);
  });

  it('reads a sequence diagram as a sequence graph', () => {
    const r = resolveGraphInput({ mermaid: 'sequenceDiagram\n  A->>B: hi' });
    expect(r.graph?.style).toBe('sequence');
    expect(r.graph?.sequence?.participants.map((p) => p.id)).toEqual(['A', 'B']);
  });

  it('drops a sequence edge to an unknown node, as every style does, never an arrow end at NaN', () => {
    const els = layoutGraph({
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [
        { from: 'a', to: 'ghost', label: 'lost' },
        { from: 'a', to: 'b', label: 'hi' },
      ],
      style: 'sequence',
    });
    const messages = els.filter((e) => e.type === 'arrow' && 'label' in e && e.label);
    expect(messages.map((m) => (m as { label?: string }).label)).toEqual(['hi']);
    expect(JSON.stringify(els)).not.toContain('null');
  });

  it('holds a sequence graph to the Mermaid sequence caps', () => {
    const nodes = Array.from({ length: 31 }, (_, i) => ({ id: `p${i}` }));
    expect(resolveGraphInput({ graph: { nodes, edges: [], style: 'sequence' } }).error).toMatch(
      /up to 30 participants/,
    );
    const edges = Array.from({ length: 301 }, () => ({ from: 'p0', to: 'p1' }));
    expect(
      resolveGraphInput({ graph: { nodes: nodes.slice(0, 2), edges, style: 'sequence' } }).error,
    ).toMatch(/300 messages/);
    // The same graph in another style is not a sequence, and keeps the graph caps.
    expect(resolveGraphInput({ graph: { nodes, edges: [] } }).error).toBeUndefined();
  });

  it('prefers graph over mermaid, and gives nothing for neither', () => {
    expect(resolveGraphInput({})).toEqual({});
    expect(
      resolveGraphInput({ graph: { nodes: [{ id: 'x' }], edges: [] } }).graph?.nodes[0]!.id,
    ).toBe('x');
  });
});

describe('review fixes (docs/specs/015-api/mcp-server.md §4.7)', () => {
  it('drops a bracketed aside before anything else', () => {
    expect(capLabel('Web client (React single page application served from the CDN)')).toEqual({
      label: 'Web client',
      cut: true,
    });
  });

  it('takes a group named on the node, as well as from members', () => {
    const els = layoutGraph({
      nodes: [
        { id: 'a', label: 'Orders', group: 'core' },
        { id: 'b', label: 'Payments', group: 'core' },
        { id: 'c', label: 'Gateway' },
      ],
      edges: [
        { from: 'c', to: 'a' },
        { from: 'c', to: 'b' },
      ],
    });
    const frame = els.find((e) => e.id === 'core') as Record<string, unknown>;
    expect(frame).toMatchObject({ shape: 'frame', label: 'core' });
  });

  it('bends a tree line down, across, then down into the child', () => {
    const els = layoutGraph({
      style: 'tree',
      nodes: [
        { id: 'r', label: 'CEO' },
        { id: 'a', label: 'CTO' },
        { id: 'b', label: 'CFO' },
      ],
      edges: [
        { from: 'r', to: 'a' },
        { from: 'r', to: 'b' },
      ],
    });
    const arrows = els.filter((e) => e.type === 'arrow') as unknown as {
      from: { anchor: string };
      to: { anchor: string };
      curvePoints?: unknown[];
    }[];
    for (const a of arrows) {
      expect(a.from.anchor).toBe('s');
      expect(a.to.anchor).toBe('n');
      expect(a.curvePoints).toHaveLength(2);
    }
  });
});

describe('layoutGraph edge ids', () => {
  it('names arrows with makeEdgeId in every layout style', () => {
    const graph = {
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    };
    let n = 0;
    const flow = layoutGraph(graph, { makeEdgeId: () => `e${++n}` });
    expect(flow.filter((el) => el.type === 'arrow').map((el) => el.id)).toEqual(['e1']);
    const tree = layoutGraph({ ...graph, style: 'tree' }, { makeEdgeId: () => 'tree-edge' });
    expect(tree.filter((el) => el.type === 'arrow').map((el) => el.id)).toEqual(['tree-edge']);
  });
});

describe('graphShapeError', () => {
  const nodes = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ];
  it('refuses an id that names both a node and a group, naming it', () => {
    const graph = {
      style: 'lanes' as const,
      nodes: [
        { id: 'panel', label: 'Onsite', group: 'panel' },
        { id: 'b', group: 'rec' },
      ],
      edges: [],
      groups: [
        { id: 'panel', label: 'Panel' },
        { id: 'rec', label: 'Recruiter' },
      ],
    };
    expect(resolveGraphInput({ graph }).error).toBe(
      'id "panel" names both a node and a group: nodes and groups share one set of ids; give each its own',
    );
    // A group declared only by a node's `group` counts too.
    expect(
      resolveGraphInput({ graph: { nodes: [{ id: 'x', group: 'x' }], edges: [] } }).error,
    ).toMatch(/^id "x" names both a node and a group/);
  });
  // Each node becomes an element of its id: two of one id laid out as two elements sharing it (a tab the api refuses)
  // or threw in the layout, where an agent should be told which id to change.
  it('refuses an id used by two nodes, or by two groups, naming it', () => {
    expect(
      resolveGraphInput({ graph: { nodes: [...nodes, { id: 'a', label: 'Again' }], edges: [] } })
        .error,
    ).toBe('node id "a" is used twice: give each node its own id');
    expect(
      resolveGraphInput({
        graph: {
          nodes,
          edges: [],
          groups: [
            { id: 'g', label: 'One' },
            { id: 'g', label: 'Two' },
          ],
        },
      }).error,
    ).toBe('group id "g" is used twice: give each group its own id');
  });
  it('refuses a node in two lanes, naming it and both lanes', () => {
    const graph = {
      style: 'lanes' as const,
      nodes: [
        { id: 'a', label: 'A', group: 'two' },
        { id: 'b', label: 'B', group: 'one' },
      ],
      edges: [],
      groups: [
        { id: 'one', label: 'One', members: ['a'] },
        { id: 'two', label: 'Two' },
      ],
    };
    expect(resolveGraphInput({ graph }).error).toBe(
      'node "a" is in two lanes, "one" and "two": a lanes graph puts each node in one lane',
    );
    // Any other style draws the node once, so it is not refused there.
    expect(
      resolveGraphInput({ graph: { ...graph, style: 'flow' as const } }).error,
    ).toBeUndefined();
  });
  it('refuses a group nested in another, naming both', () => {
    const r = resolveGraphInput({
      graph: {
        nodes,
        edges: [],
        groups: [
          { id: 'vpc', label: 'VPC', members: ['subnet'] },
          { id: 'subnet', label: 'Subnet', members: ['a'] },
        ],
      },
    });
    expect(r.error).toBe(
      'group "vpc" lists group "subnet" as a member: groups do not nest; list nodes, one group each',
    );
  });

  it('refuses a lanes graph with a node in no lane, and passes one with every node laned', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ id: `n${i}`, label: `N${i}` }));
    const loose = resolveGraphInput({
      graph: {
        style: 'lanes',
        nodes: many,
        edges: [],
        groups: [{ id: 'l', label: 'L', members: [] }],
      },
    });
    expect(loose.error).toBe(
      'a lanes graph puts every node in a lane: "n0", "n1", "n2", "n3", "n4" and 2 more in no group',
    );
    const one = resolveGraphInput({
      graph: {
        style: 'lanes',
        nodes,
        edges: [],
        groups: [{ id: 'l', label: 'L', members: ['a'] }],
      },
    });
    expect(one.error).toBe('a lanes graph puts every node in a lane: "b" in no group');
    const laned = resolveGraphInput({
      graph: {
        style: 'lanes',
        nodes: [
          { id: 'a', label: 'A', group: 'l' },
          { id: 'b', label: 'B', group: 'l' },
        ],
        edges: [],
      },
    });
    expect(laned.error).toBeUndefined();
    expect(resolveGraphInput({ graph: { style: 'lanes', nodes, edges: [] } }).error).toMatch(
      /in no group$/,
    );
  });
});
