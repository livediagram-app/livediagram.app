import type { AlignmentGuide, DistributionGuide, Element } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import type { SnapTarget } from '@/components/canvas/Canvas.types';
import { computeSnapTargets, sameDistGuides, sameGuides, sameTargets } from './drag-geometry';

describe('sameGuides', () => {
  const g: AlignmentGuide[] = [{ axis: 'x', position: 10, start: 0, end: 100 }];

  it('is true for value-equal lists', () => {
    expect(sameGuides(g, [{ axis: 'x', position: 10, start: 0, end: 100 }])).toBe(true);
  });

  it('is false when lengths differ', () => {
    expect(sameGuides(g, [])).toBe(false);
  });

  it('is false when any field differs', () => {
    expect(sameGuides(g, [{ axis: 'y', position: 10, start: 0, end: 100 }])).toBe(false);
    expect(sameGuides(g, [{ axis: 'x', position: 11, start: 0, end: 100 }])).toBe(false);
  });
});

describe('sameDistGuides', () => {
  const d: DistributionGuide[] = [{ axis: 'x', gap: 20, spans: [{ from: 0, to: 10, cross: 5 }] }];

  it('is true for value-equal lists', () => {
    expect(
      sameDistGuides(d, [{ axis: 'x', gap: 20, spans: [{ from: 0, to: 10, cross: 5 }] }]),
    ).toBe(true);
  });

  it('is false when the gap differs', () => {
    expect(
      sameDistGuides(d, [{ axis: 'x', gap: 21, spans: [{ from: 0, to: 10, cross: 5 }] }]),
    ).toBe(false);
  });

  it('is false when a span differs or the span count differs', () => {
    expect(
      sameDistGuides(d, [{ axis: 'x', gap: 20, spans: [{ from: 0, to: 11, cross: 5 }] }]),
    ).toBe(false);
    expect(sameDistGuides(d, [{ axis: 'x', gap: 20, spans: [] }])).toBe(false);
  });
});

describe('sameTargets', () => {
  const t: SnapTarget[] = [{ x: 1, y: 2, active: false }];

  it('is true for value-equal lists', () => {
    expect(sameTargets(t, [{ x: 1, y: 2, active: false }])).toBe(true);
  });

  it('is false when a coordinate or the active flag differs', () => {
    expect(sameTargets(t, [{ x: 1, y: 3, active: false }])).toBe(false);
    expect(sameTargets(t, [{ x: 1, y: 2, active: true }])).toBe(false);
    expect(sameTargets(t, [])).toBe(false);
  });
});

describe('computeSnapTargets', () => {
  const shape = (over: Record<string, unknown> = {}): Element =>
    ({
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      ...over,
    }) as Element;
  // Arrows aren't boxed, so they never contribute anchors.
  const arrow = (): Element =>
    ({ id: 'a', type: 'arrow', from: { x: 0, y: 0 }, to: { x: 10, y: 10 } }) as Element;

  it('reveals all 16 anchors of a shape under the cursor', () => {
    const out = computeSnapTargets({ x: 50, y: 30 }, [shape()], null, null);
    expect(out).toHaveLength(16);
    expect(out.every((t) => !t.active)).toBe(true);
  });

  it("reveals only a circle's eight anchors (docs/specs/008-canvas/arrow-anchors.md)", () => {
    const circle = { ...shape(), shape: 'circle' } as Element;
    expect(computeSnapTargets({ x: 50, y: 30 }, [circle], null, null)).toHaveLength(8);
  });

  it('flags exactly the active (element, anchor) anchor', () => {
    const out = computeSnapTargets({ x: 50, y: 30 }, [shape()], 's', 'n');
    expect(out.filter((t) => t.active)).toHaveLength(1);
  });

  it('skips shapes outside the reveal margin', () => {
    expect(computeSnapTargets({ x: 500, y: 500 }, [shape()], null, null)).toEqual([]);
  });

  it('reveals a shape when the cursor is within the margin but outside the box', () => {
    // Box spans x 0..100; margin is generous, so x = -20 still reveals.
    expect(computeSnapTargets({ x: -20, y: 30 }, [shape()], null, null)).toHaveLength(16);
    // Far enough past the margin: nothing.
    expect(computeSnapTargets({ x: -200, y: 30 }, [shape()], null, null)).toEqual([]);
  });

  it('ignores non-boxed elements (arrows)', () => {
    expect(computeSnapTargets({ x: 5, y: 5 }, [arrow()], null, null)).toEqual([]);
  });
});
