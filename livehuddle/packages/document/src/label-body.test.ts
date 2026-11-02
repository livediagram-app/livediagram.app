import { describe, expect, it } from 'vitest';
import { createShape, createSticky, type BoxedElement } from './index';
import { CYLINDER_BASE_BOTTOM, CYLINDER_LID_BOTTOM, labelBodyInset } from './label-body';
import { shapeGeometry } from './shape-geometry';

// docs/specs/008-canvas/canvas-and-palette.md "Shape primitives": a cylinder's label sits on the
// front of its body, below the lid and above the base's bulge.

const cylinder = { ...createShape('cylinder', 0, 0), width: 100, height: 200 } as BoxedElement;

describe('labelBodyInset', () => {
  it('starts a cylinder label under its lid and ends it above its base', () => {
    const inset = labelBodyInset(cylinder);
    expect(inset.top).toBeCloseTo(54, 9);
    expect(inset.bottom).toBeCloseTo(6, 9);
  });

  it('follows the drawn lid and base: the ellipse 15% down, 12% tall either way', () => {
    const lid = shapeGeometry('cylinder')!.parts.find((p) => p.tag === 'ellipse');
    expect(lid).toMatchObject({ cy: 15, ry: 12 });
    expect(CYLINDER_LID_BOTTOM).toBeCloseTo(0.27, 12);
    expect(CYLINDER_BASE_BOTTOM).toBeCloseTo(0.97, 12);
  });

  it('leaves every other kind its whole box', () => {
    for (const kind of ['square', 'circle', 'diamond', 'document'] as const) {
      expect(labelBodyInset(createShape(kind, 0, 0) as BoxedElement)).toEqual({
        top: 0,
        bottom: 0,
      });
    }
    expect(labelBodyInset(createSticky(0, 0))).toEqual({ top: 0, bottom: 0 });
  });
});
