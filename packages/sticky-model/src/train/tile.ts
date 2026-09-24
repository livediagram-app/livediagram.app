// Cutting a square training tile out of a wall (synthetic or real): a window
// at some origin and zoom, then one of the eight flips and quarter turns of
// the square. Colour is sampled bilinearly, classes by nearest neighbour, and
// anything past the source's edge is IGNORE, never learnt from.

export const IGNORE = 255;

export type TileSource = {
  width: number;
  height: number;
  rgb: Uint8Array;
  classes: Uint8Array;
};

export type TileView = {
  originX: number;
  originY: number;
  // Output pixels per source pixel: 2 zooms in, 0.5 zooms out.
  scale: number;
  // 0..7: bit 0 flips x, bit 1 flips y, bit 2 swaps the axes.
  transform: number;
};

export type Tile = { size: number; rgb: Uint8Array; classes: Uint8Array };

export function sampleTile(src: TileSource, size: number, view: TileView): Tile {
  const rgb = new Uint8Array(size * size * 3);
  const classes = new Uint8Array(size * size).fill(IGNORE);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let u = view.transform & 4 ? y : x;
      let v = view.transform & 4 ? x : y;
      if (view.transform & 1) u = size - 1 - u;
      if (view.transform & 2) v = size - 1 - v;
      const sx = view.originX + (u + 0.5) / view.scale - 0.5;
      const sy = view.originY + (v + 0.5) / view.scale - 0.5;
      const nx = Math.round(sx);
      const ny = Math.round(sy);
      if (nx < 0 || ny < 0 || nx >= src.width || ny >= src.height) continue;
      const o = y * size + x;
      classes[o] = src.classes[ny * src.width + nx]!;
      const x0 = Math.max(0, Math.min(src.width - 1, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(src.height - 1, Math.floor(sy)));
      const x1 = Math.min(src.width - 1, x0 + 1);
      const y1 = Math.min(src.height - 1, y0 + 1);
      const tx = Math.max(0, Math.min(1, sx - x0));
      const ty = Math.max(0, Math.min(1, sy - y0));
      for (let c = 0; c < 3; c += 1) {
        const a = src.rgb[(y0 * src.width + x0) * 3 + c]!;
        const b = src.rgb[(y0 * src.width + x1) * 3 + c]!;
        const d = src.rgb[(y1 * src.width + x0) * 3 + c]!;
        const e = src.rgb[(y1 * src.width + x1) * 3 + c]!;
        rgb[o * 3 + c] = Math.round(
          (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty,
        );
      }
    }
  }
  return { size, rgb, classes };
}
