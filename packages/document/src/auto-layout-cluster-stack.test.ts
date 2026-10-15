// Stacked groups line up (docs/specs/015-api/mcp-server.md "Stacked groups line up").
import { describe, expect, it } from 'vitest';
import { FRAME_PAD, layoutClusteredGraph } from './auto-layout-clusters';
import { isBoxed, type BoxedElement, type DiagramGraph, type Element } from './index';

const ids = () => {
  let i = 0;
  return () => `edge-${++i}`;
};
const byId = (els: Element[], id: string) => els.find((e) => e.id === id) as BoxedElement;
const mid = (el: BoxedElement) => el.x + el.width / 2;

// A pipeline: a fan of three checks, then a one-box stage, then a stage whose decision branches aside.
const pipeline: DiagramGraph = {
  nodes: [
    { id: 'push', label: 'Push' },
    { id: 'lint', label: 'Lint' },
    { id: 'unit', label: 'Unit tests' },
    { id: 'build', label: 'Build' },
    { id: 'image', label: 'Build image' },
    { id: 'approve', label: 'Approve' },
    { id: 'ok', label: 'Healthy?', shape: 'diamond' },
    { id: 'roll', label: 'Roll out' },
    { id: 'back', label: 'Roll back' },
    { id: 'page', label: 'Page on-call' },
  ],
  edges: [
    { from: 'push', to: 'lint' },
    { from: 'push', to: 'unit' },
    { from: 'push', to: 'build' },
    { from: 'lint', to: 'image' },
    { from: 'unit', to: 'image' },
    { from: 'build', to: 'image' },
    { from: 'image', to: 'approve' },
    { from: 'approve', to: 'ok' },
    { from: 'ok', to: 'roll' },
    { from: 'ok', to: 'back' },
    { from: 'back', to: 'page' },
  ],
  clusters: [
    { id: 'ci', label: 'CI', members: ['lint', 'unit', 'build'] },
    { id: 'pkg', label: 'Package', members: ['image'] },
    { id: 'prod', label: 'Production', members: ['approve', 'ok', 'roll', 'back', 'page'] },
  ],
};

describe('stacked groups', () => {
  const els = layoutClusteredGraph(pipeline, { direction: 'TB', makeEdgeId: ids() });
  const frames = ['ci', 'pkg', 'prod'].map((id) => byId(els, id));

  it('keep each frame its own width', () => {
    expect(new Set(frames.map((f) => f.width)).size).toBe(3);
  });

  it("put each stage's one entry on the line of what feeds it, its members kept inside its frame", () => {
    const feeders = ['lint', 'unit', 'build'].map((id) => mid(byId(els, id)));
    const fed = feeders.reduce((s, x) => s + x, 0) / feeders.length;
    expect(Math.abs(mid(byId(els, 'image')) - fed)).toBeLessThan(1);
    expect(Math.abs(mid(byId(els, 'approve')) - mid(byId(els, 'image')))).toBeLessThan(1);
    const prod = frames[2]!;
    for (const id of ['approve', 'ok', 'roll', 'back', 'page']) {
      const m = byId(els, id);
      expect(m.x).toBeGreaterThanOrEqual(prod.x);
      expect(m.x + m.width).toBeLessThanOrEqual(prod.x + prod.width);
    }
  });

  it('keep a node after the last stage under the member it follows, once the stage has moved', () => {
    const els2 = layoutClusteredGraph(
      {
        ...pipeline,
        nodes: [...pipeline.nodes, { id: 'done', label: 'Released' }],
        edges: [...pipeline.edges, { from: 'roll', to: 'done' }],
      },
      { direction: 'TB', makeEdgeId: ids() },
    );
    expect(Math.abs(mid(byId(els2, 'done')) - mid(byId(els2, 'roll')))).toBeLessThan(1);
  });

  it('leave groups side by side as they were', () => {
    const els2 = layoutClusteredGraph(
      {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C wide label here' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'a', to: 'c' },
        ],
        clusters: [
          { id: 'g1', label: 'One', members: ['b'] },
          { id: 'g2', label: 'Two', members: ['c'] },
        ],
      },
      { direction: 'TB', makeEdgeId: ids() },
    ).filter(isBoxed);
    const [g1, g2] = ['g1', 'g2'].map((id) => byId(els2, id));
    expect(g1!.width).not.toBe(g2!.width);
  });
});

describe('a long heading', () => {
  it('leads its frame in on the heading side only, the far side hugging the members', () => {
    const els = layoutClusteredGraph(
      {
        nodes: [
          { id: 'top', label: 'Deploy' },
          { id: 'x', label: 'E2E' },
          { id: 'y', label: 'Scan' },
        ],
        edges: [
          { from: 'top', to: 'x' },
          { from: 'top', to: 'y' },
        ],
        clusters: [
          { id: 'g', label: 'Staging verification, run in parallel', members: ['x', 'y'] },
        ],
      },
      { direction: 'TB', makeEdgeId: ids() },
    );
    const g = byId(els, 'g');
    const [x, y] = ['x', 'y'].map((id) => byId(els, id));
    const right = Math.max(x!.x + x!.width, y!.x + y!.width);
    expect(g.x + g.width - right).toBe(FRAME_PAD);
    // The heading side keeps more room than the far side.
    expect(Math.min(x!.x, y!.x) - g.x).toBeGreaterThan(FRAME_PAD);
  });
});
