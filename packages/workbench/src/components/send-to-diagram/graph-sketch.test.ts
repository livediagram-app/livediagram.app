// The picker's preview layout (graph-sketch.ts): layered, rings and lifelines, linear on the largest graph.
import { describe, expect, it } from 'vitest';
import type { DiagramSendGraph } from '@liveworkspace/index-client';
import { SKETCH_BOX_H, SKETCH_BOX_W, sketchGraph } from './graph-sketch';

const chain: DiagramSendGraph = {
  nodes: [
    { id: 'a', label: 'Start' },
    { id: 'b', label: 'Check', shape: 'diamond', group: 'g' },
    { id: 'c', label: 'Done', group: 'g' },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c', label: 'Yes' },
    { from: 'c', to: 'a', line: 'dashed' },
  ],
  groups: [{ id: 'g', label: 'Review' }],
};

const at = (s: ReturnType<typeof sketchGraph>, id: string) => s.boxes.find((b) => b.id === id)!;

describe('sketchGraph', () => {
  it('lays a flow down in layers, breaking a cycle, with a frame round each group', () => {
    const s = sketchGraph({ ...chain, direction: 'down' });
    expect(at(s, 'a').y).toBeLessThan(at(s, 'b').y);
    expect(at(s, 'b').y).toBeLessThan(at(s, 'c').y);
    expect(s.lines).toHaveLength(3);
    expect(s.lines[2]!.dashed).toBe(true);
    expect(s.lines[1]!.label).toBe('Yes');
    expect(s.frames).toEqual([expect.objectContaining({ label: 'Review' })]);
    for (const b of s.boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + SKETCH_BOX_W).toBeLessThanOrEqual(s.width);
      expect(b.y + SKETCH_BOX_H).toBeLessThanOrEqual(s.height);
    }
  });

  it('lays a flow across when asked', () => {
    const s = sketchGraph({ ...chain, direction: 'right' });
    expect(at(s, 'a').x).toBeLessThan(at(s, 'b').x);
    expect(at(s, 'a').y).toBe(at(s, 'b').y);
  });

  it('puts a mind map round its busiest box, a stray box hung off it', () => {
    const s = sketchGraph({
      style: 'mindmap',
      nodes: [
        { id: 'x', label: 'Leaf' },
        { id: 'r', label: 'Root' },
        { id: 'y', label: 'Leaf 2' },
        { id: 'z', label: 'Alone' },
      ],
      edges: [
        { from: 'r', to: 'x' },
        { from: 'r', to: 'y' },
      ],
    });
    expect(s.boxes[0]!.id).toBe('r');
    expect(s.boxes).toHaveLength(4);
  });

  it('draws a sequence as lifelines with its messages in order, repeats kept', () => {
    const s = sketchGraph({
      style: 'sequence',
      nodes: [
        { id: 'u', label: 'User' },
        { id: 's', label: 'Server' },
      ],
      edges: [
        { from: 'u', to: 's', label: 'Sign in' },
        { from: 's', to: 'u', label: 'Token', line: 'dashed' },
        { from: 'u', to: 's', label: 'Fetch' },
      ],
    });
    expect(s.lifelines).toHaveLength(2);
    expect(s.lines.map((l) => l.label)).toEqual(['Sign in', 'Token', 'Fetch']);
    expect(s.lines[0]!.y1).toBeLessThan(s.lines[1]!.y1);
    expect(s.lines[1]!.x1).toBeGreaterThan(s.lines[1]!.x2);
  });

  it('lays out the largest graph a send may hold quickly', () => {
    const nodes = Array.from({ length: 60 }, (_, i) => ({ id: `n${i}`, label: `Box ${i}` }));
    const edges = Array.from({ length: 120 }, (_, i) => ({
      from: `n${i % 60}`,
      to: `n${(i * 7 + 1) % 60}`,
    })).filter((e) => e.from !== e.to);
    const started = performance.now();
    for (let i = 0; i < 50; i++) {
      sketchGraph({ nodes, edges });
      sketchGraph({ nodes, edges, style: 'mindmap' });
    }
    expect(performance.now() - started).toBeLessThan(500);
  });
});
