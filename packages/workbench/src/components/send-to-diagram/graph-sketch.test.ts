// The picker's preview layout (graph-sketch.ts): layered, rings and lifelines, linear on the largest graph.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
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
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 50; i++) {
        sketchGraph({ nodes, edges });
        sketchGraph({ nodes, edges, style: 'mindmap' });
      }
    });
    expect(ms).toBeLessThan(cpuBudgetMs(500));
  });

  it('lays a graph down or across, whichever fills a wide preview more', () => {
    // One step fanning out to five: down it is a wide strip; across it is nearer the preview's shape.
    const fan = {
      nodes: [{ id: 'r', label: 'Root' }].concat(
        Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, label: `Child ${i}` })),
      ),
      edges: Array.from({ length: 5 }, (_, i) => ({ from: 'r', to: `c${i}` })),
    };
    const at = (s: ReturnType<typeof sketchGraph>, id: string) => s.boxes.find((b) => b.id === id)!;
    const down = sketchGraph(fan);
    expect(at(down, 'r').y).toBeLessThan(at(down, 'c0').y);
    const fitted = sketchGraph(fan, 2.2);
    expect(at(fitted, 'r').x).toBeLessThan(at(fitted, 'c0').x);
    expect(at(fitted, 'c0').x).toBe(at(fitted, 'c4').x);
    // A short chain already fits: it stays down.
    const chain = {
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    };
    expect(at(sketchGraph(chain, 0.5), 'a').y).toBeLessThan(at(sketchGraph(chain, 0.5), 'b').y);
  });
});
