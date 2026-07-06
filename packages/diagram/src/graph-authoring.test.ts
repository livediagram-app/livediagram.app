import { describe, it, expect } from 'vitest';
import { graphToElements } from './graph-authoring';
import { isValidTab } from './validate';
import { autoLayoutElements } from './auto-layout';

// Deterministic edge ids so assertions don't depend on randomUUID.
let n = 0;
const seqId = () => `edge-${++n}`;

describe('graphToElements', () => {
  it('turns nodes into shape boxes and edges into pinned arrows', () => {
    n = 0;
    const els = graphToElements(
      {
        nodes: [
          { id: 'a', label: 'Start', shape: 'stadium' },
          { id: 'b', label: 'Decide', shape: 'diamond' },
        ],
        edges: [{ from: 'a', to: 'b', label: 'go' }],
      },
      seqId,
    );
    const a = els.find((e) => e.id === 'a')!;
    expect(a.type).toBe('shape');
    expect((a as { shape: string }).shape).toBe('stadium');
    expect((a as { label?: string }).label).toBe('Start');

    const arrow = els.find((e) => e.type === 'arrow')!;
    expect(arrow.id).toBe('edge-1');
    expect((arrow as { from: { elementId: string } }).from.elementId).toBe('a');
    expect((arrow as { to: { elementId: string } }).to.elementId).toBe('b');
    expect((arrow as { label?: string }).label).toBe('go');
  });

  it('coerces off-vocabulary shapes and defaults to square', () => {
    const els = graphToElements({
      nodes: [{ id: 'x', shape: 'rectangle' }, { id: 'y' }],
      edges: [],
    });
    expect((els[0] as { shape: string }).shape).toBe('square'); // "rectangle" → square
    expect((els[1] as { shape: string }).shape).toBe('square'); // omitted → square
  });

  it('drops edges that reference a missing node', () => {
    const els = graphToElements({
      nodes: [{ id: 'a' }],
      edges: [
        { from: 'a', to: 'ghost' },
        { from: 'nope', to: 'a' },
      ],
    });
    expect(els.filter((e) => e.type === 'arrow')).toHaveLength(0);
  });

  it('produces a valid, auto-layoutable tab (positions + reanchors)', () => {
    n = 0;
    const els = graphToElements(
      {
        nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
        ],
      },
      seqId,
    );
    const laidOut = autoLayoutElements(els);
    expect(isValidTab({ id: 't', name: 'T', elements: laidOut })).toBe(true);
    // All nodes start piled at the origin; layout must spread them.
    const xs = new Set(
      laidOut.filter((e) => e.type === 'shape').map((e) => (e as { x: number }).x),
    );
    const ys = new Set(
      laidOut.filter((e) => e.type === 'shape').map((e) => (e as { y: number }).y),
    );
    expect(xs.size + ys.size).toBeGreaterThan(2);
  });
});
