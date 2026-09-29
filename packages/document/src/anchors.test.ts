import { describe, expect, it } from 'vitest';
import {
  ALL_ANCHORS,
  anchorClass,
  anchorFraction,
  anchorLiesOn,
  anchorOutward,
  anchorPrimarySide,
  anchorSides,
  anchorsOf,
  offeredAnchors,
  offeredOnSide,
  sideOffered,
  type BoxedElement,
} from './index';

describe('anchor vocabulary (docs/specs/008-canvas/arrow-anchors.md)', () => {
  it('lists sixteen unique anchors clockwise from north', () => {
    expect(ALL_ANCHORS).toEqual([
      'n',
      'nne',
      'ne',
      'ene',
      'e',
      'ese',
      'se',
      'sse',
      's',
      'ssw',
      'sw',
      'wsw',
      'w',
      'wnw',
      'nw',
      'nnw',
    ]);
    expect(new Set(ALL_ANCHORS).size).toBe(16);
  });

  it('keeps the eight anchors that predate the quarters', () => {
    for (const a of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']) {
      expect(ALL_ANCHORS).toContain(a);
    }
  });

  it('classes every anchor as corner, quarter or middle', () => {
    const byClass = (cls: string) => ALL_ANCHORS.filter((a) => anchorClass(a) === cls);
    expect(byClass('corner')).toEqual(['ne', 'se', 'sw', 'nw']);
    expect(byClass('middle')).toEqual(['n', 'e', 's', 'w']);
    expect(byClass('quarter')).toEqual(['nne', 'ene', 'ese', 'sse', 'ssw', 'wsw', 'wnw', 'nnw']);
  });

  it('puts middles and quarters on one side and corners on two', () => {
    expect(anchorSides('nne')).toEqual(['n']);
    expect(anchorSides('ene')).toEqual(['e']);
    expect(anchorSides('w')).toEqual(['w']);
    expect(anchorSides('ne')).toEqual(['n', 'e']);
    expect(anchorSides('se')).toEqual(['s', 'e']);
    expect(anchorSides('sw')).toEqual(['s', 'w']);
    expect(anchorSides('nw')).toEqual(['n', 'w']);
    expect(anchorLiesOn('ne', 'e')).toBe(true);
    expect(anchorLiesOn('ne', 's')).toBe(false);
    expect(anchorLiesOn('wsw', 'w')).toBe(true);
  });

  it('gives a corner its horizontal edge as primary side', () => {
    expect(anchorPrimarySide('ne')).toBe('n');
    expect(anchorPrimarySide('sw')).toBe('s');
    expect(anchorPrimarySide('ene')).toBe('e');
    expect(anchorPrimarySide('ssw')).toBe('s');
  });

  it('lists the anchors of one class on one side', () => {
    expect(anchorsOf('e', 'middle')).toEqual(['e']);
    expect(anchorsOf('e', 'quarter')).toEqual(['ene', 'ese']);
    expect(anchorsOf('e', 'corner')).toEqual(['ne', 'se']);
    expect(anchorsOf('n', 'quarter')).toEqual(['nne', 'nnw']);
    expect(anchorsOf('w', 'corner')).toEqual(['sw', 'nw']);
  });

  it('places each anchor at its fraction of the box', () => {
    expect(anchorFraction('nne')).toEqual({ fx: 0.75, fy: 0 });
    expect(anchorFraction('ese')).toEqual({ fx: 1, fy: 0.75 });
    expect(anchorFraction('ssw')).toEqual({ fx: 0.25, fy: 1 });
    expect(anchorFraction('wnw')).toEqual({ fx: 0, fy: 0.25 });
    expect(anchorFraction('se')).toEqual({ fx: 1, fy: 1 });
    expect(anchorFraction('w')).toEqual({ fx: 0, fy: 0.5 });
  });

  it("points a quarter outward along its side's normal", () => {
    expect(anchorOutward('nne')).toEqual({ x: 0, y: -1 });
    expect(anchorOutward('ese')).toEqual({ x: 1, y: 0 });
    expect(anchorOutward('ne').x).toBeCloseTo(0.707, 3);
    expect(anchorOutward('ne').y).toBeCloseTo(-0.707, 3);
  });
});

describe('offered anchors per kind (docs/specs/008-canvas/arrow-anchors.md "Anchors per shape")', () => {
  const el = (shape: string) =>
    ({ id: 'x', type: 'shape', shape, x: 0, y: 0, width: 100, height: 100 }) as BoxedElement;
  const compass = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

  it('offers sixteen on a box and eight on a circle, diamond and actor', () => {
    expect(offeredAnchors(el('square'))).toEqual(ALL_ANCHORS);
    for (const k of ['circle', 'diamond', 'actor']) expect(offeredAnchors(el(k))).toEqual(compass);
  });

  it('offers nine on a triangle: three per face, no corners, nothing on top', () => {
    expect(offeredAnchors(el('triangle'))).toEqual([
      'ene',
      'e',
      'ese',
      'sse',
      's',
      'ssw',
      'wsw',
      'w',
      'wnw',
    ]);
    expect(sideOffered(el('triangle'), 'n')).toBe(false);
    expect(sideOffered(el('triangle'), 'w')).toBe(true);
  });

  it('offers fourteen on a document: no bottom corners', () => {
    const doc = offeredAnchors(el('document'));
    expect(doc).toHaveLength(14);
    expect(doc).not.toContain('sw');
    expect(doc).not.toContain('se');
  });

  it('keeps every side that carries anchors carrying its middle', () => {
    for (const k of ['square', 'circle', 'triangle', 'document', 'actor']) {
      for (const side of ['n', 'e', 's', 'w'] as const) {
        if (sideOffered(el(k), side)) expect(offeredAnchors(el(k)), `${k} ${side}`).toContain(side);
      }
    }
  });

  it('falls back to the nearest offered class on a side', () => {
    expect(offeredOnSide(el('square'), 'e', 'quarter')).toEqual(['ene', 'ese']);
    expect(offeredOnSide(el('circle'), 'e', 'quarter')).toEqual(['ne', 'se']);
    expect(offeredOnSide(el('triangle'), 'w', 'corner')).toEqual(['wsw', 'wnw']);
    expect(offeredOnSide(el('document'), 's', 'corner')).toEqual(['sse', 'ssw']);
    expect(offeredOnSide(el('triangle'), 'n', 'middle')).toEqual([]);
  });
});
