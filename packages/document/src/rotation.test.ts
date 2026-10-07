import { describe, expect, it } from 'vitest';
import { createPinnedArrow, createShape } from './factories';
import { supportsRotation } from './rotation';
import type { Element } from './index';

// docs/specs/009-elements/blueprints/annotations.md [QD8]: Rotation is hidden for annotations.
describe('supportsRotation', () => {
  it('lets a boxed element rotate', () => {
    expect(supportsRotation(createShape('square', 0, 0))).toBe(true);
  });

  it('never rotates an annotation marker', () => {
    const marker = { ...createShape('square', 0, 0), type: 'annotation' } as unknown as Element;
    expect(supportsRotation(marker)).toBe(false);
  });

  it('never rotates an arrow', () => {
    expect(supportsRotation(createPinnedArrow('a', 'e', 'b', 'w'))).toBe(false);
  });
});
