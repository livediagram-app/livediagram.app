import { clamp, hexToRgb } from '@livediagram/diagram';
import { encodePng } from '@livediagram/sticky-vision/png';

// A photograph of a sticky wall, drawn rather than photographed.
//
// The detector is REAL in the photo-import e2e — it is the half of the feature
// that does not involve the model, so mocking it would leave the most
// interesting code untested in a browser. That means the test needs an actual
// image file, and a committed binary is a thing nobody can review or adjust.
// So the wall is drawn here, as pixels, and encoded as a PNG with the
// calibration scripts' encoder (node's own zlib): no dependency, no fixture to
// keep in step with the catalogue.

type Rgb = [number, number, number];

const WALL: Rgb = [241, 245, 249];

export type WallNote = {
  // The catalogue fill of the kind this note is.
  fill: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

// Draw the notes on a wall and encode the result as a PNG. As drawn, the
// wall is flat to the bit, which the editor reads as a drawing (a screenshot)
// and never asks the boundary model about; `grain` adds that many levels of
// sensor-like noise either way to every pixel, so it reads as a photograph.
export function wallPhotoPng(
  width: number,
  height: number,
  notes: WallNote[],
  opts: { grain?: number } = {},
): Buffer {
  // One RGB triple per pixel, wall everywhere to begin with.
  const pixels = new Uint8Array(width * height * 3);
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = WALL[0];
    pixels[i + 1] = WALL[1];
    pixels[i + 2] = WALL[2];
  }
  for (const note of notes) {
    const { r, g, b } = hexToRgb(note.fill)!;
    for (let y = note.y; y < note.y + note.h; y += 1) {
      for (let x = note.x; x < note.x + note.w; x += 1) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const i = (y * width + x) * 3;
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
      }
    }
    // A couple of marker strokes, so the note is not a solid rectangle — the
    // real case, and the one that exercises the fragment merge.
    for (const stroke of [0.35, 0.55]) {
      const yy = Math.round(note.y + note.h * stroke);
      for (let x = note.x + 8; x < note.x + note.w - 8; x += 1) {
        for (let dy = 0; dy < 4; dy += 1) {
          const i = ((yy + dy) * width + x) * 3;
          if (i < 0 || i + 2 >= pixels.length) continue;
          pixels[i] = 17;
          pixels[i + 1] = 24;
          pixels[i + 2] = 39;
        }
      }
    }
  }
  if (opts.grain) addGrain(pixels, opts.grain);
  return encodePng({ width, height, data: pixels }, { channels: 3 });
}

// Deterministic noise: the same wall is the same PNG every run.
function addGrain(pixels: Uint8Array, grain: number): void {
  for (let i = 0; i < pixels.length; i += 1) {
    const n = Math.sin(i * 12.9898) * 43758.5453;
    const offset = Math.round((n - Math.floor(n)) * 2 * grain) - grain;
    pixels[i] = clamp(pixels[i]! + offset, 0, 255);
  }
}
