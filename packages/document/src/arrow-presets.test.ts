import { describe, expect, it } from 'vitest';
import {
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowStyleOf,
  arrowThicknessOf,
  type ArrowElement,
} from './index';

const arrow = (overrides: Partial<ArrowElement> = {}): ArrowElement => ({
  id: 'a',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 10, y: 0 },
  ...overrides,
});

// Preset widths: thin 1, medium 2, thick 4, extra-thick 7 (default medium).
describe('arrowThicknessOf', () => {
  it('returns the default (medium) when strokeWidth is unset', () => {
    expect(arrowThicknessOf(arrow())).toBe('medium');
  });

  it('maps an exact preset width to its preset', () => {
    expect(arrowThicknessOf(arrow({ strokeWidth: 1 }))).toBe('thin');
    expect(arrowThicknessOf(arrow({ strokeWidth: 2 }))).toBe('medium');
    expect(arrowThicknessOf(arrow({ strokeWidth: 4 }))).toBe('thick');
    expect(arrowThicknessOf(arrow({ strokeWidth: 7 }))).toBe('extra-thick');
  });

  it('snaps an in-between width to the nearest preset', () => {
    expect(arrowThicknessOf(arrow({ strokeWidth: 1.4 }))).toBe('thin');
    expect(arrowThicknessOf(arrow({ strokeWidth: 1.6 }))).toBe('medium');
    expect(arrowThicknessOf(arrow({ strokeWidth: 5 }))).toBe('thick');
    expect(arrowThicknessOf(arrow({ strokeWidth: 6 }))).toBe('extra-thick');
  });

  it('clamps an out-of-range width to the nearest end preset', () => {
    expect(arrowThicknessOf(arrow({ strokeWidth: 0 }))).toBe('thin');
    expect(arrowThicknessOf(arrow({ strokeWidth: 100 }))).toBe('extra-thick');
  });

  it('breaks an exact tie toward the lower preset (so exactly one toggle lights)', () => {
    // 3 is equidistant from medium (2) and thick (4); the strict `<` keeps
    // the earlier-iterated medium. This is what guarantees the Palette's
    // toggle group always highlights exactly one option for any width.
    expect(arrowThicknessOf(arrow({ strokeWidth: 3 }))).toBe('medium');
    // 5.5 is equidistant from thick (4) and extra-thick (7)... no: |4-5.5|=1.5,
    // |7-5.5|=1.5, tie -> the earlier thick wins.
    expect(arrowThicknessOf(arrow({ strokeWidth: 5.5 }))).toBe('thick');
  });
});

describe('arrowhead + style resolvers (default when unset, pass through when set)', () => {
  it('arrowheadSizeOf defaults to medium', () => {
    expect(arrowheadSizeOf(arrow())).toBe('medium');
    expect(arrowheadSizeOf(arrow({ arrowheadSize: 'large' }))).toBe('large');
  });

  it('arrowheadShapeOf defaults to triangle', () => {
    expect(arrowheadShapeOf(arrow())).toBe('triangle');
    expect(arrowheadShapeOf(arrow({ arrowheadShape: 'diamond-hollow' }))).toBe('diamond-hollow');
  });

  it('arrowStyleOf defaults to straight', () => {
    expect(arrowStyleOf(arrow())).toBe('straight');
    expect(arrowStyleOf(arrow({ arrowStyle: 'curved' }))).toBe('curved');
  });
});
