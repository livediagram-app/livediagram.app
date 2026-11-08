import type { AlignmentGuide, DistributionGuide } from '@livehuddle/document';
import { describe, expect, it } from 'vitest';
import type { SnapTarget } from '@/components/canvas/Canvas.types';
import { sameDistGuides, sameGuides, sameTargets } from './drag-geometry';

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

  it('is false when a span switches to a cross-axis reference', () => {
    expect(
      sameDistGuides(d, [
        { axis: 'x', gap: 20, spans: [{ axis: 'y', from: 0, to: 10, cross: 5 }] },
      ]),
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
