import { describe, expect, it } from 'vitest';
import { classifyRgb } from './classify';
import type { ImageBuffer } from './colour';
import { detectStickies } from './detect';
import { localFloorsOf, wallFloorsOf, type PaperFloors } from './floors';
import { rgbToLab } from './lab';

// The wall's own colour, measured in CIELAB, as a second opinion on paper at
// the wall's hue (spec/139 Phase 9). HSV saturation climbs as kraft darkens,
// so shadowed kraft clears a saturation floor that lit kraft does not; in
// a*b* it is still the wall.

const KRAFT: [number, number, number] = [168, 144, 122];
const SHADOWED_KRAFT: [number, number, number] = [123, 93, 67];
const ORANGE: [number, number, number] = [253, 186, 116];

function kraftFloors(): PaperFloors {
  const wall = rgbToLab(...KRAFT);
  // A kraft wall's floors as the tiles measure them: paper from s≥0.42, the
  // wall's hue at 29°, and its colour in a*b*.
  return { saturation: 0.42, value: 0.2, wallHue: 29, wallA: wall.a, wallB: wall.b };
}

function wall(width: number, height: number, [r, g, b]: [number, number, number]): ImageBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

function fill(
  image: ImageBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  [r, g, b]: [number, number, number],
): void {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      const i = (yy * image.width + xx) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
    }
  }
}

describe('paper at the wall’s own hue, judged in CIELAB', () => {
  it('reads shadowed kraft as wall, though its HSV saturation clears the floor', () => {
    expect(classifyRgb(...SHADOWED_KRAFT, kraftFloors())).toBe('wall');
  });

  it('still reads orange paper at the wall’s hue as paper', () => {
    expect(classifyRgb(...ORANGE, kraftFloors())).toBe('domain-event');
  });

  it('leaves paper off the wall’s hue to the saturation floor alone', () => {
    // A pale lilac policy on a white wall: close to the wall in a*b*, but not
    // at its hue, which is what the lower off-hue floor exists for.
    const white = rgbToLab(240, 240, 240);
    const floors: PaperFloors = {
      saturation: 0.28,
      value: 0.2,
      wallHue: 40,
      wallA: white.a,
      wallB: white.b,
    };
    expect(classifyRgb(214, 200, 236, floors)).toBe('policy');
  });

  it('classifies by HSV alone where the wall’s colour is not known', () => {
    const { wallA: _a, wallB: _b, ...hsvOnly } = kraftFloors();
    expect(classifyRgb(...SHADOWED_KRAFT, hsvOnly)).toBe('domain-event');
  });
});

describe('measuring the wall’s colour', () => {
  it('finds the wall’s a*b* over the whole frame and per tile', () => {
    const image = wall(400, 300, KRAFT);
    fill(image, 40, 40, 80, 80, ORANGE);
    const expected = rgbToLab(...KRAFT);
    const frame = wallFloorsOf(image);
    expect(frame.wallA).toBeCloseTo(expected.a, -0.5);
    expect(frame.wallB).toBeCloseTo(expected.b, -0.5);
    const local = localFloorsOf(image).floorsAt(300, 200);
    expect(local.wallA).toBeCloseTo(expected.a, -0.5);
    expect(local.wallB).toBeCloseTo(expected.b, -0.5);
  });
});

describe('detecting on kraft with a shadow on it', () => {
  it('does not take a patch of shadowed kraft for an orange note', () => {
    const image = wall(800, 400, KRAFT);
    for (let i = 0; i < 4; i += 1) fill(image, 60 + i * 130, 60, 90, 90, ORANGE);
    // A note-sized pool of shade, as under a curling sheet or a lamp's edge.
    fill(image, 300, 240, 90, 90, SHADOWED_KRAFT);
    const found = detectStickies(image);
    expect(found).toHaveLength(4);
    expect(found.every((s) => s.y < 200)).toBe(true);
  });
});
