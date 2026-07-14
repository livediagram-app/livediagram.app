import type { ArrowElement, ShapeElement } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { quickAddPlacement } from './quick-add-placement';

// The source element every test quick-adds from: 100x50 at the origin.
const base = { x: 0, y: 0, width: 100, height: 50 };

const square = (overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  ...overrides,
});

const arrow = (overrides: Partial<ArrowElement> = {}): ArrowElement => ({
  id: 'a',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 100, y: 100 },
  ...overrides,
});

const place = (
  elements: (ShapeElement | ArrowElement)[],
  direction: 'right' | 'left' | 'above' | 'below',
  ids: string[] = ['src'],
) => quickAddPlacement({ elements, ids: new Set(ids), baseBounds: base, direction });

describe('quickAddPlacement — lone source (default gap)', () => {
  it.each([
    ['right', { dx: 140, dy: 0 }],
    ['left', { dx: -140, dy: 0 }],
    ['below', { dx: 0, dy: 90 }],
    ['above', { dx: 0, dy: -90 }],
  ] as const)('steps one size + 40px gap %s', (direction, expected) => {
    expect(place([square({ id: 'src' })], direction)).toEqual(expected);
  });
});

describe('quickAddPlacement — gap matching', () => {
  it('adopts the nearest in-line neighbour gap instead of the default', () => {
    // Neighbour 24px to the right of the source's right edge, same row.
    // The matched-gap slot coincides with the neighbour exactly, so the
    // occupancy loop takes a second 124px step: past it, same rhythm.
    const els = [square({ id: 'src' }), square({ id: 'n', x: 124 })];
    expect(place(els, 'right')).toEqual({ dx: 248, dy: 0 });
  });

  it('measures the gap from either side of the source', () => {
    // Only neighbour sits to the LEFT with a 10px gap; duplicating right
    // still adopts that spacing (the chain keeps its rhythm).
    const els = [square({ id: 'src' }), square({ id: 'n', x: -110 })];
    expect(place(els, 'right')).toEqual({ dx: 110, dy: 0 });
  });

  it('ignores elements whose perpendicular extent misses the source row', () => {
    // 24px gap but a different row entirely: falls back to the 40px default.
    const els = [square({ id: 'src' }), square({ id: 'n', x: 124, y: 500 })];
    expect(place(els, 'right')).toEqual({ dx: 140, dy: 0 });
  });

  it('matches column gaps for vertical directions', () => {
    const els = [square({ id: 'src' }), square({ id: 'n', y: 62 })]; // 12px below
    expect(place(els, 'below')).toEqual({ dx: 0, dy: 124 }); // one height + 12, stepped past
  });
});

describe('quickAddPlacement — occupancy stepping', () => {
  it('steps past an element already occupying the landing slot', () => {
    // Neighbour exactly one default step to the right: the first slot
    // overlaps it, so placement takes a second identical step.
    const els = [square({ id: 'src' }), square({ id: 'n', x: 140 })];
    expect(place(els, 'right')).toEqual({ dx: 280, dy: 0 });
  });

  it('skips the source selection itself when testing overlap', () => {
    // A multi-select source: both members are in `ids`, so neither the
    // gap scan nor the overlap test sees them.
    const els = [square({ id: 'src' }), square({ id: 'src2', x: 140 })];
    expect(place(els, 'right', ['src', 'src2'])).toEqual({ dx: 140, dy: 0 });
  });
});

describe('quickAddPlacement — non-boxed elements', () => {
  it('ignores arrows for both the gap scan and occupancy', () => {
    const els = [square({ id: 'src' }), arrow({ id: 'a1', from: { kind: 'free', x: 120, y: 10 } })];
    expect(place(els, 'right')).toEqual({ dx: 140, dy: 0 });
  });
});
