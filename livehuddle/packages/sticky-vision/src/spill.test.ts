import { describe, expect, it } from 'vitest';
import { hexToRgb, type ImageBuffer } from './colour';
import { dropSurfaces, spillOf } from './spill';

// A note is an object, and its paper stops at its edge (docs/specs/021-event-storming/event-storming.md Phase 9).
// Every image here is drawn, so how far a colour runs past a box is known.

function blank(width: number, height: number, hex: string): ImageBuffer {
  const { r, g, b } = hexToRgb(hex);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

function paint(image: ImageBuffer, x: number, y: number, w: number, h: number, hex: string) {
  const { r, g, b } = hexToRgb(hex);
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      const i = (yy * image.width + xx) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
    }
  }
}

const KRAFT = '#b08a60';
const ORANGE = '#fdba74';
const NIGHT_SKY = '#2f4f8f';

describe('spillOf', () => {
  it('reads a note on a wall of another colour as bounded', () => {
    const image = blank(200, 200, KRAFT);
    paint(image, 80, 80, 40, 40, ORANGE);
    expect(spillOf(image, { x: 80, y: 80, w: 40, h: 40 })).toBeLessThan(0.05);
  });

  it('reads a box cut out of a large surface as spilling far past it', () => {
    const image = blank(200, 200, KRAFT);
    paint(image, 0, 0, 200, 120, NIGHT_SKY);
    expect(spillOf(image, { x: 80, y: 40, w: 40, h: 40 })).toBeGreaterThan(3);
  });

  it('measures the rest of a note a box holds only half of', () => {
    const image = blank(200, 200, KRAFT);
    paint(image, 80, 80, 40, 40, ORANGE);
    expect(spillOf(image, { x: 80, y: 80, w: 20, h: 40 })).toBeCloseTo(1, 1);
  });

  it('does not count paper another box already holds', () => {
    const image = blank(200, 200, KRAFT);
    paint(image, 40, 80, 80, 40, ORANGE);
    const left = { x: 40, y: 80, w: 40, h: 40 };
    const right = { x: 80, y: 80, w: 40, h: 40 };
    expect(spillOf(image, left, [right])).toBeLessThan(0.05);
  });

  it('sees no further than a few boxes round the box', () => {
    const image = blank(400, 400, NIGHT_SKY);
    expect(spillOf(image, { x: 180, y: 180, w: 40, h: 40 })).toBeLessThan(49);
  });
});

describe('dropSurfaces', () => {
  it('drops a box cut out of a surface and keeps the notes', () => {
    const image = blank(300, 200, KRAFT);
    paint(image, 0, 0, 300, 60, NIGHT_SKY);
    const pane = { x: 130, y: 10, w: 40, h: 40 };
    const note = { x: 40, y: 100, w: 40, h: 40 };
    const pair = [
      { x: 150, y: 100, w: 40, h: 40 },
      { x: 190, y: 100, w: 40, h: 40 },
    ];
    paint(image, note.x, note.y, note.w, note.h, ORANGE);
    paint(image, 150, 100, 80, 40, ORANGE);
    expect(dropSurfaces(image, [pane, note, ...pair])).toEqual([note, ...pair]);
  });

  it('keeps a note that a missed neighbour of its own colour touches', () => {
    const image = blank(300, 200, KRAFT);
    paint(image, 100, 80, 80, 40, ORANGE);
    const found = { x: 100, y: 80, w: 40, h: 40 };
    expect(dropSurfaces(image, [found])).toEqual([found]);
  });

  it('lets no dropped box shield the surface for its neighbour', () => {
    const image = blank(300, 200, KRAFT);
    paint(image, 0, 10, 200, 50, NIGHT_SKY);
    // The left pane is walled in by the frame, the kraft and the right pane;
    // only once the right pane is known to be sky is it open to the sky.
    const left = { x: 0, y: 10, w: 40, h: 50 };
    const right = { x: 40, y: 10, w: 40, h: 50 };
    expect(spillOf(image, left, [right])).toBeLessThan(0.05);
    expect(dropSurfaces(image, [left, right])).toEqual([]);
  });

  it('reports what it drops', () => {
    const image = blank(200, 200, NIGHT_SKY);
    const pane = { x: 80, y: 80, w: 40, h: 40 };
    const dropped: unknown[] = [];
    expect(dropSurfaces(image, [pane], (b) => dropped.push(b))).toEqual([]);
    expect(dropped).toEqual([pane]);
  });
});
