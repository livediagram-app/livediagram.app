import { describe, expect, it } from 'vitest';
import { isFixedSizeShape, isFixedSizeElement } from './selection-mode';

describe('fixed-size shapes', () => {
  it('names the kinds that never take resize handles', () => {
    // A badge fits its text (docs/specs/009-elements/badge.md): a bigger box only spreads it over empty space.
    expect(isFixedSizeShape('badge')).toBe(true);
    expect(isFixedSizeShape('rectangle')).toBe(false);
    expect(isFixedSizeElement({ type: 'shape', shape: 'badge' })).toBe(true);
    expect(isFixedSizeElement({ type: 'shape', shape: 'rectangle' })).toBe(false);
    expect(isFixedSizeElement({ type: 'shape', shape: 'rectangle', fixedSize: true })).toBe(true);
  });
});
