import { afterEach, describe, expect, it } from 'vitest';
import {
  footprintFractions,
  modelFootprintsOn,
  officeFootprints,
  setModelFootprints,
} from './office-geometry';

// livehuddle's 3d-engine.md "Block models": while the 3D view draws, a turned piece blocks where its model stands,
// the front drawing's footprint turned with it. The editor's model-footprints.test.ts checks it against the models.
afterEach(() => setModelFootprints(null));

describe('model footprints', () => {
  it('are off until the 3D view turns them on, and off again after', () => {
    expect(modelFootprintsOn()).toBe(false);
    setModelFootprints(() => 'n');
    expect(modelFootprintsOn()).toBe(true);
    setModelFootprints(null);
    expect(modelFootprintsOn()).toBe(false);
  });

  it('turn the front footprint a quarter turn at a time', () => {
    const [front] = footprintFractions('fridge', 'n');
    setModelFootprints(() => 'n');
    expect(footprintFractions('fridge', 'n')).toEqual([front]);
    const f = front!;
    expect(footprintFractions('fridge', 'e')).toEqual([
      { x0: 1 - f.y1, x1: 1 - f.y0, y0: f.x0, y1: f.x1 },
    ]);
    expect(footprintFractions('fridge', 's')).toEqual([
      { x0: 1 - f.x1, x1: 1 - f.x0, y0: 1 - f.y1, y1: 1 - f.y0 },
    ]);
    expect(footprintFractions('fridge', 'w')).toEqual([
      { x0: f.y0, x1: f.y1, y0: 1 - f.x1, y1: 1 - f.x0 },
    ]);
  });

  it("place a piece's boxes at the facing its model stands at, not the one stored", () => {
    const el = { shape: 'fridge', x: 0, y: 0, width: 100, height: 100, chairFacing: 'n' as const };
    const drawn = officeFootprints(el);
    setModelFootprints(() => 's');
    const modelled = officeFootprints(el);
    expect(modelled).not.toEqual(drawn);
    const [f] = footprintFractions('fridge', 's');
    expect(modelled).toEqual([
      {
        x: 100 * f!.x0,
        y: 100 * f!.y0,
        width: 100 * (f!.x1 - f!.x0),
        height: 100 * (f!.y1 - f!.y0),
      },
    ]);
  });
});
