import { describe, expect, it, vi } from 'vitest';
import { idBound } from './element-layer-props';

// docs/specs/008-canvas/canvas-performance.md: per-element objects the layer hands each view are
// identity-stable, so a view's memo holds across editor renders.
describe('idBound', () => {
  it('builds one object per id and hands the same one back', () => {
    const make = vi.fn((id: string) => ({ id }));
    const forId = idBound(make);
    const first = forId('a');
    expect(forId('a')).toBe(first);
    expect(forId('b')).not.toBe(first);
    expect(make).toHaveBeenCalledTimes(2);
  });
});
