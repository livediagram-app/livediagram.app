import { describe, expect, it } from 'vitest';
import { isKnownElement, kindWordOf } from './element-refs';
import { createShape, createSticky, createText } from './factories';
import type { Element } from './index';

// The refs themselves are @liveworkspace/element-model's (element-refs.test.ts there); this is this model's kinds.
describe('kindWordOf (R9)', () => {
  it('names a shape by its kind', () => {
    expect(kindWordOf(createShape('cylinder', 0, 0))).toBe('cylinder');
    expect(kindWordOf(createShape('frame', 0, 0))).toBe('frame');
    expect(kindWordOf(createShape('actor', 0, 0))).toBe('actor');
  });

  it('names an element by its type', () => {
    expect(kindWordOf(createText(0, 0))).toBe('text');
    expect(kindWordOf(createSticky(0, 0))).toBe('sticky');
  });

  it('marks unknown types and shapes with ? (E12)', () => {
    const unknownShape = { ...createShape('square', 0, 0), shape: 'blob' } as unknown as Element;
    expect(kindWordOf(unknownShape)).toBe('? blob');
    const noShape = { ...createShape('square', 0, 0), shape: undefined } as unknown as Element;
    expect(kindWordOf(noShape)).toBe('? shape');
    const unknownType = { id: 'x', type: 'hologram' } as unknown as Element;
    expect(kindWordOf(unknownType)).toBe('? hologram');
    const hostile = { id: 'x', type: 'a b\nc' } as unknown as Element;
    expect(kindWordOf(hostile)).toBe('? "a b\\nc"');
  });

  it('knows exactly the types and shapes the project model knows', () => {
    expect(isKnownElement(createShape('hexagon', 0, 0))).toBe(true);
    expect(isKnownElement(createText(0, 0))).toBe(true);
    expect(
      isKnownElement({ ...createShape('square', 0, 0), shape: 'blob' } as unknown as Element),
    ).toBe(false);
    expect(isKnownElement({ id: 'x', type: 'hologram' } as unknown as Element)).toBe(false);
  });
});
