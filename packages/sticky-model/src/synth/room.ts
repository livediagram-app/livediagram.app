import { hsvToRgb, valueNoise, type Plane, type Rgb } from './raster';
import type { Rng } from './rng';

// The part of a photograph that is not the wall: the room past its edge (a
// window, a shelf, the ceiling) and things standing in front of it (boxes, a
// chair). Painted LAST and over everything, with the note ids cleared: paper
// hidden behind a box is not a note the photo can show, and colourful clutter
// in the room is exactly the junk the model must learn to leave alone.

function objectColour(rng: Rng): Rgb {
  return rng.chance(0.35)
    ? hsvToRgb(rng.range(0, 360), rng.range(0.4, 0.9), rng.range(0.4, 1))
    : hsvToRgb(rng.range(0, 360), rng.range(0, 0.3), rng.range(0.05, 0.9));
}

function fillRegion(
  plane: Plane,
  rng: Rng,
  inside: (x: number, y: number) => boolean,
  colour: Rgb,
): void {
  const n = valueNoise(rng, rng.range(4, 40));
  const amp = rng.range(0, 0.25);
  for (let y = 0; y < plane.height; y += 1) {
    for (let x = 0; x < plane.width; x += 1) {
      if (!inside(x, y)) continue;
      const p = y * plane.width + x;
      const f = 1 + (n(x, y) - 0.5) * 2 * amp;
      plane.rgb[p * 3] = colour[0] * f;
      plane.rgb[p * 3 + 1] = colour[1] * f;
      plane.rgb[p * 3 + 2] = colour[2] * f;
      plane.ids[p] = 0;
    }
  }
}

// Returns where the room is, when the frame shows one, so loose notes can be
// dropped into it (a note fallen on the floor, one stuck on a window).
export function paintRoom(
  plane: Plane,
  rng: Rng,
  size: number,
): ((x: number, y: number) => boolean) | null {
  let room: ((x: number, y: number) => boolean) | null = null;
  if (rng.chance(0.35)) {
    // The wall ends: one side of the frame is the room.
    const side = rng.int(0, 3);
    const depth = rng.range(0.08, 0.4) * (side % 2 === 0 ? plane.width : plane.height);
    const slope = rng.range(-0.08, 0.08);
    const beyond = (x: number, y: number) =>
      side === 0
        ? x < depth + slope * y
        : side === 1
          ? y < depth + slope * x
          : side === 2
            ? x > plane.width - depth + slope * y
            : y > plane.height - depth + slope * x;
    room = beyond;
    fillRegion(plane, rng, beyond, objectColour(rng));
    // Furniture and windows in the room, in any colour at all.
    const things = rng.int(1, 6);
    for (let i = 0; i < things; i += 1) {
      const w = rng.range(0.5, 4) * size;
      const h = rng.range(0.5, 4) * size;
      const x0 = rng.range(0, plane.width);
      const y0 = rng.range(0, plane.height);
      fillRegion(
        plane,
        rng,
        (x, y) => beyond(x, y) && x >= x0 && x < x0 + w && y >= y0 && y < y0 + h,
        objectColour(rng),
      );
    }
  }
  const standing = rng.chance(0.25) ? rng.int(1, 2) : 0;
  for (let i = 0; i < standing; i += 1) {
    const w = rng.range(1.5, 6) * size;
    const h = rng.range(1.5, 5) * size;
    const x0 = rng.range(-w / 2, plane.width - w / 2);
    const y0 = plane.height - h * rng.range(0.5, 1);
    fillRegion(plane, rng, (x, y) => x >= x0 && x < x0 + w && y >= y0, objectColour(rng));
  }
  return room;
}
