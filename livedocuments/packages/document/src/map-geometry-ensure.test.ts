import { describe, expect, it } from 'vitest';
import { ensureMapGeometry } from './map-geometry-ensure';
import { providedMapGeometry } from './map-model';
import { createShape } from './shape-factory';

// docs/specs/009-elements/map.md "Exports and other surfaces": a renderer loads the land only for a tab with a map.
describe('ensureMapGeometry', () => {
  it('loads nothing for a tab without a map, then provides it for one with a map', async () => {
    await ensureMapGeometry([createShape('square', 0, 0)]);
    expect(providedMapGeometry()).toBeNull();
    await ensureMapGeometry([createShape('map', 0, 0)]);
    expect(providedMapGeometry()?.countries.length).toBeGreaterThan(150);
    await ensureMapGeometry([createShape('map', 0, 0)]);
    expect(providedMapGeometry()).not.toBeNull();
  });
});
