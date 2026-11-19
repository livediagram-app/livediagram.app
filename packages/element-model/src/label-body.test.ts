import { describe, expect, it } from 'vitest';
import { createShape, createSticky } from './testing/elements';
import { type BoxedElement } from './element';
import {
  CYLINDER_BASE_BOTTOM,
  CYLINDER_LID_BOTTOM,
  PARALLELOGRAM_SIDE,
  TRAPEZOID_SIDE,
  labelBodyInset,
} from './label-body';
import { labelMaxWidth } from './svg-render-primitives';
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
        side: 0,
      });
    }
    expect(labelBodyInset(createSticky(0, 0))).toEqual({ top: 0, bottom: 0, side: 0 });
  });

  it('keeps a slanted kind\'s label inside its slants where they cross the middle', () => {
    const at = (kind: 'parallelogram' | 'trapezoid') =>
      labelBodyInset({ ...createShape(kind, 0, 0), width: 200, height: 80 } as BoxedElement);
    expect(at('parallelogram')).toEqual({ top: 0, bottom: 0, side: 20 });
    expect(at('trapezoid').side).toBeCloseTo(24, 9);
    // The drawn outlines: the parallelogram's left side runs 20,0 to 0,100 (x 10 at mid-height), the
    // trapezoid's 22,4 to 2,96 (x 12).
    expect(PARALLELOGRAM_SIDE).toBe((20 + 0) / 2 / 100);
    expect(TRAPEZOID_SIDE).toBe((22 + 2) / 2 / 100);
  });

  it('wraps a slanted kind\'s export label inside its slants', () => {
    const shape = { ...createShape('parallelogram', 0, 0), width: 200, height: 80 } as BoxedElement;
    expect(labelMaxWidth(shape, 6)).toBe(200 - 12 - 40);
  });
});
