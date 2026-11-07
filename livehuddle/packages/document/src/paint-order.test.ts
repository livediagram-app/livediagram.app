import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createShape } from './shape-factory';
import { paintOrder } from './paint-order';
import type { Element } from './index';

// docs/specs/006-document/layers.md "Stacking": backdrops first, the larger first, but grass, then garden paths in
// array order, then the other floors.
const sized = (
  kind: Parameters<typeof createShape>[0],
  id: string,
  w: number,
  h: number,
): Element => ({
  ...createShape(kind, 0, 0),
  id,
  width: w,
  height: h,
});

describe('paintOrder', () => {
  it('paints grass, then garden paths in array order whatever their size, then the other floors larger first', () => {
    const els = [
      sized('chair', 'chair', 76, 84),
      sized('garden-path', 'stub', 64, 140),
      sized('rug', 'rug', 200, 120),
      sized('garden-path', 'walk', 64, 900),
      sized('room', 'room', 500, 600),
      sized('garden-path', 'plaza', 300, 300),
      sized('grass', 'lawn', 2000, 1200),
    ];
    expect(paintOrder(els).map((e) => e.id)).toEqual([
      'lawn',
      'stub',
      'walk',
      'plaza',
      'room',
      'rug',
      'chair',
    ]);
  });

  // docs/specs/009-elements/room-builder.md "Window": its light lies on the floor, under furniture placed before it.
  it('paints a window over its room and rug but under furniture placed before it', () => {
    const els = [
      sized('room', 'room', 500, 400),
      sized('sofa', 'sofa', 152, 85),
      sized('window', 'east', 120, 24),
      sized('rug', 'rug', 200, 120),
      sized('window', 'north', 200, 24),
    ];
    expect(paintOrder(els).map((e) => e.id)).toEqual(['room', 'rug', 'east', 'north', 'sofa']);
  });

  it('returns the same array when it is already in order', () => {
    const els = [
      sized('grass', 'lawn', 900, 900),
      sized('garden-path', 'a', 64, 64),
      sized('chair', 'c', 76, 84),
    ];
    expect(paintOrder(els)).toBe(els);
  });

  // Untimed warm-up passes, then the fastest of a few, as attachment.perf.test.ts does.
  it('orders a 5,000-element tab with every floor out of place within 50 ms of CPU', () => {
    const els = Array.from({ length: 5000 }, (_, i) =>
      sized(
        i % 3 === 0 ? 'garden-path' : i % 3 === 1 ? 'rug' : 'chair',
        `e${i}`,
        64 + (i % 97),
        64,
      ),
    );
    for (let pass = 0; pass < 3; pass++) paintOrder(els);
    let best = Infinity;
    for (let pass = 0; pass < 5; pass++)
      best = Math.min(
        best,
        cpuMsOf(() => paintOrder(els)),
      );
    expect(best).toBeLessThan(cpuBudgetMs(50));
  });
});
