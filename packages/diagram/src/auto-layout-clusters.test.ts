import { describe, it, expect } from 'vitest';
import { layoutClusteredGraph, sweepEdgelessNodes } from './auto-layout-clusters';
import { isValidTab } from './validate';
import { isBoxed, type BoxedElement, type DiagramGraph, type Element } from './index';

const makeIds = () => {
  let i = 0;
  return () => `edge-${++i}`;
};

const boxes = (els: Element[]) => els.filter(isBoxed);
const byId = (els: Element[], id: string) => els.find((e) => e.id === id) as BoxedElement;

const contains = (frame: BoxedElement, el: BoxedElement) =>
  el.x >= frame.x &&
  el.y >= frame.y &&
  el.x + el.width <= frame.x + frame.width &&
  el.y + el.height <= frame.y + frame.height;

describe('layoutClusteredGraph', () => {
  it('is the plain layout when the graph has no clusters', () => {
    const els = layoutClusteredGraph(
      {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        edges: [{ from: 'a', to: 'b' }],
      },
      { makeEdgeId: makeIds() },
    );
    expect(els.filter((e) => e.type === 'arrow')).toHaveLength(1);
    // TB layout: b ranks below a.
    expect(byId(els, 'b').y).toBeGreaterThan(byId(els, 'a').y);
  });

  it('draws a frame around each cluster and keeps members inside it', () => {
    const graph: DiagramGraph = {
      nodes: ['a', 'b', 'c', 'free'].map((id) => ({ id, label: id })),
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'free' },
      ],
      clusters: [{ id: 's1', label: 'Group', members: ['a', 'b', 'c'] }],
    };
    const els = layoutClusteredGraph(graph, { makeEdgeId: makeIds() });
    const frame = byId(els, 's1');
    expect(frame).toMatchObject({ type: 'shape', shape: 'frame', label: 'Group' });
    for (const id of ['a', 'b', 'c']) expect(contains(frame, byId(els, id))).toBe(true);
    expect(contains(frame, byId(els, 'free'))).toBe(false);
    // The frame renders behind its members.
    expect(els.findIndex((e) => e.id === 's1')).toBeLessThan(els.findIndex((e) => e.id === 'a'));
    // All four graph edges become arrows, and the whole thing is a valid tab.
    expect(els.filter((e) => e.type === 'arrow')).toHaveLength(3);
    expect(isValidTab({ id: 't', name: 'T', elements: els })).toBe(true);
  });

  it('keeps two clusters apart and lays the contracted graph in the direction', () => {
    const graph: DiagramGraph = {
      nodes: ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id })),
      edges: [
        { from: 'a', to: 'b' },
        { from: 'c', to: 'd' },
        { from: 'b', to: 'c' },
      ],
      clusters: [
        { id: 'left', members: ['a', 'b'] },
        { id: 'right', members: ['c', 'd'] },
      ],
    };
    const els = layoutClusteredGraph(graph, { direction: 'LR', makeEdgeId: makeIds() });
    const left = byId(els, 'left');
    const right = byId(els, 'right');
    // LR: the downstream cluster sits to the right, with no overlap.
    expect(right.x).toBeGreaterThanOrEqual(left.x + left.width);
  });

  it('pins an arrow to the frame when an edge references the cluster id', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'b', to: 's1' }],
      clusters: [{ id: 's1', members: ['a'] }],
    };
    const els = layoutClusteredGraph(graph, { makeEdgeId: makeIds() });
    const arrow = els.find((e) => e.type === 'arrow');
    expect(arrow?.type).toBe('arrow');
    if (arrow?.type !== 'arrow') return;
    expect(arrow.to).toMatchObject({ kind: 'pinned', elementId: 's1' });
  });

  it('drops a cluster whose id collides with a node id', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
      clusters: [{ id: 'a', members: ['b'] }],
    };
    const els = layoutClusteredGraph(graph, { makeEdgeId: makeIds() });
    expect(
      els.filter((e) => e.type === 'shape' && 'shape' in e && e.shape === 'frame'),
    ).toHaveLength(0);
  });

  it('preserves a cluster block bigger than the shape-tier clamp', () => {
    // Seven members in a chain make a block far taller than the 220px tier
    // clamp — fixedSizeIds must carry the true size through the contracted
    // layout, or members would spill out of the frame.
    const ids = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'];
    const graph: DiagramGraph = {
      nodes: [...ids.map((id) => ({ id, label: id })), { id: 'out', label: 'Out' }],
      edges: [
        ...ids.slice(1).map((id, i) => ({ from: ids[i]!, to: id })),
        { from: 'n7', to: 'out' },
      ],
      clusters: [{ id: 'big', members: ids }],
    };
    const els = layoutClusteredGraph(graph, { makeEdgeId: makeIds() });
    const frame = byId(els, 'big');
    expect(frame.height).toBeGreaterThan(400);
    for (const id of ids) expect(contains(frame, byId(els, id))).toBe(true);
  });
});

describe('sweepEdgelessNodes', () => {
  const shape = (id: string, x = 0, y = 0): Element => ({
    id,
    type: 'shape',
    shape: 'square',
    x,
    y,
    width: 120,
    height: 120,
    label: id,
  });

  it('moves edgeless nodes out of the origin pile into non-overlapping rows', () => {
    const els = sweepEdgelessNodes([shape('a'), shape('b'), shape('c')]);
    const placed = boxes(els);
    const keys = new Set(placed.map((e) => `${e.x},${e.y}`));
    expect(keys.size).toBe(3);
  });

  it('places them below the connected content and leaves exempt ids alone', () => {
    const connected: Element[] = [
      shape('a', 0, 0),
      shape('b', 0, 300),
      {
        id: 'arr',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 'a', anchor: 's' },
        to: { kind: 'pinned', elementId: 'b', anchor: 'n' },
      },
    ];
    const els = sweepEdgelessNodes(
      [...connected, shape('loose', 0, 0), shape('fixed', 10, 10)],
      new Set(['fixed']),
    );
    expect(byId(els, 'loose').y).toBeGreaterThan(byId(els, 'b').y + 120);
    expect(byId(els, 'fixed')).toMatchObject({ x: 10, y: 10 });
  });
});
