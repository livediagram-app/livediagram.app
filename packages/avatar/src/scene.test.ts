import { describe, expect, it } from 'vitest';
import { hasSceneBox, isSceneShape } from './scene';

// What the package reads of a product's elements (livediagram's docs/specs/008-canvas/avatar-mode.md "Where the
// code lives").
describe('the scene contract', () => {
  it('knows a shape by its type', () => {
    expect(isSceneShape({ id: 'a', type: 'shape' })).toBe(true);
    expect(isSceneShape({ id: 'b', type: 'arrow' })).toBe(false);
  });

  it('gives a box to an element with numbers for its place and size, and none to an arrow', () => {
    expect(hasSceneBox({ id: 's', type: 'sticky', x: 0, y: 0, width: 10, height: 10 })).toBe(true);
    expect(hasSceneBox({ id: 'a', type: 'arrow' })).toBe(false);
    expect(hasSceneBox({ id: 'h', type: 'shape', x: 0, y: 0, width: 10 })).toBe(false);
    expect(hasSceneBox({ id: 'w', type: 'shape', x: 0, y: 0, height: 10 })).toBe(false);
    expect(hasSceneBox({ id: 'y', type: 'shape', x: 0, width: 1, height: 1 })).toBe(false);
  });
});
