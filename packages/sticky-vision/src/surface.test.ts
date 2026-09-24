import { describe, expect, it } from 'vitest';
import type { ImageBuffer } from './colour';
import { localFloorsOf, wallFloorsOf } from './floors';

// A blown-out pixel — a ceiling lamp, a window, glare off a whiteboard — has
// every channel at the top of the sensor's range. It says nothing about the
// colour of what it is a picture of, so it is no evidence of the wall.

function wall(width: number, height: number, rgb: [number, number, number]): ImageBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return { width, height, data };
}

function fill(image: ImageBuffer, x: number, y: number, w: number, h: number, v: number): void {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      const i = (yy * image.width + xx) * 4;
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
    }
  }
}

describe('measuring a wall with a lamp in the picture', () => {
  it('does not take a blown-out lamp for the wall where it shines', () => {
    // Kraft, v≈0.66: paper there must be brighter than 0.7 of that. A lamp
    // filling most of one floor tile would otherwise set that tile's wall at
    // v=1 and throw every note darker than 0.7 into the wall.
    const image = wall(800, 400, [168, 144, 122]);
    fill(image, 400, 100, 75, 100, 255);
    const floors = localFloorsOf(image).floorsAt(450, 150);
    expect(floors.value).toBeLessThan(0.5);
  });

  it('still measures a white wall that is bright but not blown out', () => {
    const floors = wallFloorsOf(wall(400, 300, [241, 245, 249]));
    expect(floors.value).toBeGreaterThan(0.6);
  });
});
