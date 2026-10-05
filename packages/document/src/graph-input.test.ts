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

  it('routes arrows per style: angled for a tree, curved for a mind map, or as asked', () => {
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
    expect(arrows(layoutGraph(branch))[0]!.arrowStyle ?? 'straight').toBe('straight');
    expect(arrows(layoutGraph({ ...branch, lines: 'angled' }))[0]!.arrowStyle).toBe('angled');
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
    const r = resolveGraphInput({ mermaid: 'sequenceDiagram\n  A->>B: hi' });
    expect(r.error).toMatch(/flowcharts/);
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
