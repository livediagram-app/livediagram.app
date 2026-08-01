import { describe, expect, it } from 'vitest';

import type { ShapeElement } from '@livediagram/diagram';

import { entityHeaderHeight } from './EntityView';

const entity = (textSize?: ShapeElement['textSize']) =>
  ({ type: 'shape', shape: 'entity', textSize }) as ShapeElement;

describe('entityHeaderHeight', () => {
  it('leaves the default size exactly where it was', () => {
    // Existing diagrams must not shift by a pixel.
    expect(entityHeaderHeight(entity())).toBe(30);
    expect(entityHeaderHeight(entity('scale'))).toBe(30);
  });

  it('grows with the title, so the rule stays under the text', () => {
    // The bug: a 32px `lg` title in a 30px band overflowed it.
    expect(entityHeaderHeight(entity('lg'))).toBeGreaterThan(32);
    expect(entityHeaderHeight(entity('md'))).toBeGreaterThan(entityHeaderHeight(entity('scale')));
    expect(entityHeaderHeight(entity('lg'))).toBeGreaterThan(entityHeaderHeight(entity('md')));
  });

  it('never shrinks below the floor on the small size', () => {
    expect(entityHeaderHeight(entity('sm'))).toBe(30);
  });
});
