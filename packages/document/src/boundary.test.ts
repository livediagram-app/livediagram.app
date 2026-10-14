import { describe, expect, it } from 'vitest';
import {
  boundaryLayout,
  BOUNDARY_TINT,
  containerContents,
  createShape,
  isValidElement,
  layerBands,
  renderElementsToSvg,
  withBoundaryStyle,
  type Element,
  type ShapeElement,
} from './index';

const boundary = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  over: Partial<ShapeElement> = {},
) =>
  ({
    ...(createShape('boundary', 0, 0) as ShapeElement),
    id,
    x,
    y,
    width: w,
    height: h,
    ...over,
  }) as ShapeElement;
const square = (id: string, x: number, y: number) =>
  ({
    ...(createShape('square', 0, 0) as ShapeElement),
    id,
    x,
    y,
    width: 40,
    height: 40,
  }) as ShapeElement;

describe('boundary (docs/specs/009-elements/boundary.md)', () => {
  it('washes its area with a light tint of its accent, which stacks as boundaries nest', () => {
    expect(BOUNDARY_TINT).toBe(0.06);
  });

  it('lays a tab across the top edge, an inset title inside, a C4 title at the bottom', () => {
    const tab = boundaryLayout(400, 300, { style: 'tab', icon: true, titleChars: 10, meta: true });
    expect(tab.tab!.y).toBeLessThan(0);
    expect(tab.icon!.x).toBeGreaterThan(tab.tab!.x);
    const inset = boundaryLayout(400, 300, {
      style: 'inset',
      icon: false,
      titleChars: 3,
      meta: true,
    });
    expect(inset.tab).toBeNull();
    expect(inset.meta!.x).toBeGreaterThan(inset.title.x);
    const c4 = boundaryLayout(400, 300, { style: 'c4', icon: true, titleChars: 7, meta: true });
    expect(c4.icon).toBeNull();
    expect(c4.title.y).toBeGreaterThan(200);
  });

  it('carries what it holds, as a frame does', () => {
    const els: Element[] = [
      boundary('b', 0, 0, 300, 300),
      square('in', 50, 50),
      square('out', 500, 500),
    ];
    expect([...containerContents(els, new Set(['b']))].sort()).toEqual(['b', 'in']);
  });

  it('paints the larger backdrop first whatever the array order', () => {
    const inner = boundary('inner', 100, 100, 100, 100);
    const outer = boundary('outer', 0, 0, 500, 500);
    const [band] = layerBands([inner, square('s', 120, 120), outer], undefined);
    expect(band!.elements.map((e) => e.id)).toEqual(['outer', 'inner', 's']);
  });

  it('switches to C4 with the long dash, and back', () => {
    const c4 = withBoundaryStyle(boundary('b', 0, 0, 100, 100), 'c4');
    expect(c4).toMatchObject({ boundaryStyle: 'c4', strokeStyle: 'long-dash' });
    const back = withBoundaryStyle(c4, null);
    expect('boundaryStyle' in back).toBe(false);
    expect(back.strokeStyle).toBe('dashed');
  });

  it('validates its style', () => {
    expect(isValidElement(boundary('b', 0, 0, 10, 10, { boundaryStyle: 'inset' }))).toBe(true);
    expect(isValidElement(boundary('b', 0, 0, 10, 10, { boundaryStyle: 'cloud' as never }))).toBe(
      false,
    );
  });

  it('exports its tab title and its tint, an inner one stacking on the outer', () => {
    const svg = renderElementsToSvg({
      id: 't',
      name: 't',
      elements: [
        boundary('outer', 0, 0, 600, 400, { label: 'AWS', strokeColor: '#336699' }),
        boundary('inner', 50, 50, 300, 200, { label: 'VPC', strokeColor: '#336699' }),
      ],
    } as never);
    expect(svg).toContain('>AWS<');
    expect(svg.match(/rgba\(51, 102, 153, 0\.06\)/g)).toHaveLength(2);
  });
});
