import { describe, expect, it } from 'vitest';
import { dividerLine } from './notes';
import { planeOf } from './raster';
import { rngFrom } from './rng';

describe('dividerLine', () => {
  it('draws ink across most of the note, edge to edge', () => {
    const plane = planeOf(60, 60);
    plane.rgb.fill(1);
    const note = {
      id: 1,
      cx: 30,
      cy: 30,
      w: 40,
      h: 40,
      angle: 0,
      paper: 'orange' as const,
      colour: [1, 1, 1] as [number, number, number],
    };
    dividerLine(plane, rngFrom(3), note);
    const inkColumns = new Set<number>();
    for (let p = 0; p < 60 * 60; p += 1) if (plane.rgb[p * 3]! < 0.6) inkColumns.add(p % 60);
    expect(inkColumns.size).toBeGreaterThanOrEqual(32);
    expect([...inkColumns].every((x) => x >= 9 && x <= 50)).toBe(true);
  });
});
