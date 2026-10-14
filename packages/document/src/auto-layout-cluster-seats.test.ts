import { describe, expect, it } from 'vitest';
import { layoutClusteredGraph } from './auto-layout-clusters';
import {
  faceGroupEdges,
  frameHeadingRect,
  headingLead,
  seatByMembers,
} from './auto-layout-cluster-seats';
import { arrowPolyline } from './arrow-path-hits';
import { buildElementIndex } from './geometry';
import { pathsCross } from './index';
import { layoutGraph, type GraphInput } from './graph-input';
import type { ArrowElement, BoxedElement, DiagramGraph, Element } from './index';

// Groups keep their lines clear (docs/specs/015-api/mcp-server.md §4.7 "The graph look").

let n = 0;
const ids = () => `e${n++}`;
const byId = (els: Element[], id: string) => els.find((e) => e.id === id) as BoxedElement;
const cx = (b: BoxedElement) => b.x + b.width / 2;
const cy = (b: BoxedElement) => b.y + b.height / 2;
const arrowBetween = (els: Element[], from: string, to: string) =>
  els.find(
    (e): e is ArrowElement =>
      e.type === 'arrow' &&
      e.from.kind === 'pinned' &&
      e.from.elementId === from &&
      e.to.kind === 'pinned' &&
      e.to.elementId === to,
  )!;
const box = (id: string, x: number, y: number, w = 100, h = 60): BoxedElement =>
  ({ id, type: 'shape', shape: 'square', x, y, width: w, height: h }) as BoxedElement;

// Services in a group, each with its own store under it, and the group publishing to a bus.
const services: DiagramGraph = {
  nodes: [
    { id: 'gw', label: 'Gateway' },
    { id: 'a', label: 'Payments service' },
    { id: 'b', label: 'Auth service' },
    { id: 'c', label: 'Orders service' },
    { id: 'adb', label: 'Payments DB' },
    { id: 'cdb', label: 'Orders DB' },
    { id: 'bus', label: 'Event bus' },
  ],
  edges: [
    { from: 'gw', to: 'a' },
    { from: 'gw', to: 'b' },
    { from: 'gw', to: 'c' },
    { from: 'a', to: 'adb' },
    { from: 'c', to: 'cdb' },
    { from: 'svc', to: 'bus' },
  ],
  clusters: [{ id: 'svc', label: 'Services', members: ['a', 'b', 'c'] }],
};

describe('seatByMembers', () => {
  it('puts each store under the service it belongs to, not under the group', () => {
    const els = layoutClusteredGraph(services, { direction: 'TB', makeEdgeId: ids });
    for (const [store, owner] of [
      ['adb', 'a'],
      ['cdb', 'c'],
    ] as const)
      expect(Math.abs(cx(byId(els, store)) - cx(byId(els, owner)))).toBeLessThan(1);
  });

  it('keeps a rank in order with its gaps when two stores want one spot', () => {
    const nodes = [box('m', 0, 0), box('p', 0, 200), box('q', 150, 200)];
    seatByMembers(
      nodes,
      [],
      new Map([['m', 'g']]),
      {
        nodes: [],
        edges: [
          { from: 'm', to: 'p' },
          { from: 'm', to: 'q' },
        ],
      },
      'TB',
    );
    const [p, q] = [nodes[1]!, nodes[2]!];
    expect(p.x).toBeLessThan(q.x);
    expect(q.x - (p.x + p.width)).toBeGreaterThanOrEqual(56 - 0.001);
    expect((cx(p) + cx(q)) / 2).toBeCloseTo(cx(nodes[0]!));
  });

  it('leaves a rank a frame shares, and a node linked to two groups', () => {
    const frame = box('g', -20, 180, 400, 120);
    const nodes = [box('m', 0, 0), box('k', 300, 0), box('p', 500, 200), box('r', 500, 400)];
    const clusterOf = new Map([
      ['m', 'g'],
      ['k', 'h'],
    ]);
    const graph = {
      nodes: [],
      edges: [
        { from: 'm', to: 'p' },
        { from: 'm', to: 'r' },
        { from: 'k', to: 'r' },
      ],
    };
    seatByMembers(nodes, [frame], clusterOf, graph, 'TB');
    expect(nodes[2]!.x).toBe(500);
    expect(nodes[3]!.x).toBe(500);
  });

  it('packs a node with nothing to sit by against its seated neighbours, left to right', () => {
    // Down the left-to-right flow: a, b and c share one rank; only b links to a member.
    const nodes = [box('m', 0, 500), box('a', 200, 0), box('b', 200, 100), box('c', 200, 200)];
    seatByMembers(
      nodes,
      [],
      new Map([['m', 'g']]),
      { nodes: [], edges: [{ from: 'm', to: 'b' }] },
      'LR',
    );
    const [a, b, c] = [nodes[1]!, nodes[2]!, nodes[3]!];
    expect(cy(b)).toBe(cy(nodes[0]!));
    expect(b.y - (a.y + a.height)).toBeCloseTo(56);
    expect(c.y - (b.y + b.height)).toBeCloseTo(56);
  });

  it('lines a node up with a member a pixel or two off it, left to right too', () => {
    const nodes = [box('m', 0, 0), box('p', 200, 3)];
    seatByMembers(
      nodes,
      [],
      new Map([['m', 'g']]),
      { nodes: [], edges: [{ from: 'p', to: 'm' }] },
      'LR',
    );
    expect(cy(nodes[1]!)).toBe(cy(nodes[0]!));
  });
});

describe('faceGroupEdges', () => {
  const frame = box('g', 0, 0, 600, 200);
  const edge = (to: string): ArrowElement =>
    ({
      id: `g-${to}`,
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'g', anchor: 's' },
      to: { kind: 'pinned', elementId: to, anchor: 'n' },
    }) as ArrowElement;
  const anchorTo = (other: BoxedElement, dir: 'TB' | 'LR' = 'TB') => {
    const [a] = faceGroupEdges([edge(other.id)], [frame], [other], dir);
    return a!.from.kind === 'pinned' ? a!.from.anchor : null;
  };

  it('leaves the side facing a node under the frame, at the quarter nearest it', () => {
    expect(anchorTo(box('x', 50, 300))).toBe('ssw');
    expect(anchorTo(box('x', 250, 300))).toBe('s');
    expect(anchorTo(box('x', 450, 300))).toBe('sse');
    expect(anchorTo(box('x', 250, -300))).toBe('n');
  });

  it('leaves the near side for a node beside the frame, toward the flow end it lies on', () => {
    expect(anchorTo(box('x', 800, 300))).toBe('ese');
    expect(anchorTo(box('x', -300, 300))).toBe('wsw');
    expect(anchorTo(box('x', 800, -300))).toBe('ene');
    expect(anchorTo(box('x', 250, 400), 'LR')).toBe('sse');
  });

  it('turns the end into a frame too, and leaves other arrows alone', () => {
    const into = { ...edge('x'), from: edge('x').to, to: edge('x').from } as ArrowElement;
    const x = box('x', 800, 300);
    const [a] = faceGroupEdges([into], [frame], [x], 'TB');
    expect(a!.to).toMatchObject({ elementId: 'g', anchor: 'ese' });
    const plain = {
      ...edge('x'),
      from: { kind: 'pinned', elementId: 'y', anchor: 's' },
    } as ArrowElement;
    expect(faceGroupEdges([plain], [frame], [x, box('y', 0, 0)], 'TB')[0]).toBe(plain);
    const settled = {
      ...edge('x'),
      from: { kind: 'pinned', elementId: 'g', anchor: 'ese' },
    } as ArrowElement;
    expect(faceGroupEdges([settled], [frame], [x], 'TB')[0]).toBe(settled);
  });

  it('sends the group edge to its bus over none of the other lines', () => {
    const els = layoutGraph(
      {
        direction: 'down',
        lines: 'angled',
        groups: services.clusters!.map((c) => ({ ...c, members: [...c.members] })),
        nodes: services.nodes,
        edges: services.edges,
      },
      { makeEdgeId: ids },
    );
    const index = buildElementIndex(els);
    const pub = arrowPolyline(arrowBetween(els, 'svc', 'bus'), index);
    const others = els.filter(
      (e): e is ArrowElement =>
        e.type === 'arrow' && !(e.from.kind === 'pinned' && e.from.elementId === 'svc'),
    );
    for (const o of others) expect(pathsCross(pub, arrowPolyline(o, index)), o.id).toBe(false);
  });
});

describe('routes round a frame', () => {
  it('takes an edge between two nodes outside a group round its frame, not between its members', () => {
    const g: GraphInput = {
      direction: 'down',
      lines: 'angled',
      groups: [{ id: 'svc', label: 'Services', members: ['a', 'b', 'c', 'd'] }],
      nodes: ['gw', 'a', 'b', 'c', 'd', 'ad', 'cd', 'note'].map((id) => ({ id, label: id })),
      edges: [
        { from: 'gw', to: 'a' },
        { from: 'gw', to: 'b' },
        { from: 'gw', to: 'c' },
        { from: 'gw', to: 'd' },
        { from: 'a', to: 'ad' },
        { from: 'c', to: 'cd' },
        { from: 'ad', to: 'note' },
        { from: 'gw', to: 'note' },
      ],
    };
    const els = layoutGraph(g, { makeEdgeId: ids });
    const frame = byId(els, 'svc');
    const route = arrowPolyline(arrowBetween(els, 'gw', 'note'), buildElementIndex(els));
    const inside = (p: { x: number; y: number }) =>
      p.x > frame.x + 1 &&
      p.x < frame.x + frame.width - 1 &&
      p.y > frame.y + 1 &&
      p.y < frame.y + frame.height - 1;
    // Every run's midpoint and every corner stays outside the frame.
    const points = route.flatMap((p, i) =>
      i === 0 ? [p] : [p, { x: (p.x + route[i - 1]!.x) / 2, y: (p.y + route[i - 1]!.y) / 2 }],
    );
    expect(points.filter(inside)).toEqual([]);
  });
});

describe('frame headings', () => {
  it('reckons a heading from its label, and none for a frame without one', () => {
    expect(frameHeadingRect({ x: 10, y: 20, label: ' Build ' })).toEqual({
      x: 10,
      y: 20,
      width: 5 * 8 + 24,
      height: 36,
    });
    expect(frameHeadingRect({ x: 0, y: 0, label: '  ' })).toBeNull();
    expect(frameHeadingRect({ x: 0, y: 0 })).toBeNull();
  });

  it('leads a frame in far enough that a line into its first member clears the heading', () => {
    const members = [box('a', 0, 0, 100), box('b', 200, 0, 140), box('c', 0, 200)];
    // "Continuous integration": 22 characters, a heading 200 px wide; a's centre sits 32 + 50 in.
    const lead = headingLead('Continuous integration', members, new Set(['a']), 32, 'TB');
    expect(lead).toBe(200 + 16 - 82);
    // The narrowest entered first member is reckoned in the leftmost slot.
    expect(headingLead('Continuous integration', members, new Set(['b']), 32, 'TB')).toBe(
      200 + 16 - 102,
    );
  });

  it('takes the first rank by centre, so a taller box beside it still counts as the same row', () => {
    // A cylinder at the left, entered, and a taller cloud to its right, centred on the same line: its top sits higher.
    const members = [box('db', 0, 10, 100, 80), box('cloud', 300, 0, 120, 100)];
    expect(headingLead('Continuous integration', members, new Set(['db']), 32, 'TB')).toBe(
      200 + 16 - 82,
    );
  });

  it('leads nowhere when nothing enters a first member, or across the page, or with no heading', () => {
    const members = [box('a', 0, 0), box('c', 0, 200)];
    expect(headingLead('Continuous integration', members, new Set(['c']), 32, 'TB')).toBe(0);
    expect(headingLead('Continuous integration', members, new Set(['a']), 32, 'LR')).toBe(0);
    expect(headingLead(undefined, members, new Set(['a']), 32, 'TB')).toBe(0);
    expect(headingLead('Ok', members, new Set(['a']), 32, 'TB')).toBe(0);
    expect(headingLead('Continuous integration', [], new Set(), 32, 'TB')).toBe(0);
  });

  it('keeps every line off the heading of a group a flow enters from above', () => {
    const els = layoutClusteredGraph(
      {
        nodes: ['start', 'lint', 'unit', 'build'].map((id) => ({ id, label: id })),
        edges: ['lint', 'unit', 'build'].map((to) => ({ from: 'start', to })),
        clusters: [
          { id: 'ci', label: 'Continuous integration', members: ['lint', 'unit', 'build'] },
        ],
      },
      { direction: 'TB', makeEdgeId: ids },
    );
    const heading = frameHeadingRect(byId(els, 'ci'))!;
    for (const id of ['lint', 'unit', 'build'])
      expect(cx(byId(els, id))).toBeGreaterThan(heading.x + heading.width);
    // The lead on the heading's side only: the far side hugs the members.
    const frame = byId(els, 'ci');
    expect(frame.x + frame.width - (byId(els, 'build').x + byId(els, 'build').width)).toBe(32);
  });

  it('keeps the frame centred on its members when an edge meets the group itself, so that edge stays on the spine', () => {
    const els = layoutClusteredGraph(
      {
        nodes: ['start', 'lint', 'unit', 'build', 'next'].map((id) => ({ id, label: id })),
        edges: [
          ...['lint', 'unit', 'build'].map((to) => ({ from: 'start', to })),
          { from: 'ci', to: 'next' },
        ],
        clusters: [
          { id: 'ci', label: 'Continuous integration', members: ['lint', 'unit', 'build'] },
        ],
      },
      { direction: 'TB', makeEdgeId: ids },
    );
    expect(Math.abs(cx(byId(els, 'unit')) - cx(byId(els, 'ci')))).toBeLessThan(1);
  });
});
