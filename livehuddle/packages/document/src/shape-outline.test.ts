import { describe, expect, it } from 'vitest';
import { techIconMarkBounds } from '@liveworkspace/model-core/icon-size';
import { createShape } from './factories';
import type { BoxedElement } from './index';
import { connectorBox, pointInsideOutline } from './shape-outline';

// An element's body for pointer tests: its box, or a Technology icon's mark. The diagram shapes' drawn outlines
// left with them (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5).
const room = (over: Partial<BoxedElement> = {}) =>
  ({
    ...createShape('room', 0, 0),
    x: 100,
    y: 50,
    width: 200,
    height: 100,
    ...over,
  }) as BoxedElement;

describe('connectorBox', () => {
  it('is the element itself for an ordinary kind', () => {
    const el = room();
    expect(connectorBox(el)).toBe(el);
  });

  it("is a Technology icon's fixed-size mark, not its larger box", () => {
    const icon = {
      ...createShape('icon', 0, 0),
      iconId: 'docker',
      width: 400,
      height: 400,
    } as BoxedElement;
    expect(connectorBox(icon)).toEqual(techIconMarkBounds(icon as never));
    const plain = { ...createShape('icon', 0, 0), iconId: 'lucide:star' } as BoxedElement;
    expect(connectorBox(plain)).toBe(plain);
  });
});

describe('pointInsideOutline', () => {
  it('is inside the box by more than the inset, and not on or past its edge', () => {
    const el = room();
    expect(pointInsideOutline(el, { x: 200, y: 100 }, 0)).toBe(true);
    expect(pointInsideOutline(el, { x: 104, y: 100 }, 5)).toBe(false);
    expect(pointInsideOutline(el, { x: 106, y: 100 }, 5)).toBe(true);
    expect(pointInsideOutline(el, { x: 100, y: 100 }, 0)).toBe(false);
    expect(pointInsideOutline(el, { x: 200, y: 151 }, 0)).toBe(false);
  });

  it('undoes the element’s turn about its centre first', () => {
    // A 200 by 100 box turned a quarter stands 100 wide and 200 tall about its centre (200, 100).
    const turned = room({ rotation: 90 });
    expect(pointInsideOutline(turned, { x: 200, y: 20 }, 0)).toBe(true);
    expect(pointInsideOutline(room(), { x: 200, y: 20 }, 0)).toBe(false);
    expect(pointInsideOutline(turned, { x: 120, y: 100 }, 0)).toBe(false);
  });
});
