// The boundary model's input and output framing, shared by the Node scripts
// and the browser: whatever runs the network, the photo goes in and the
// probabilities come out through exactly these steps, so the editor and the
// sweep see the same numbers.

// The U-Net halves the image four times, so both sides must be a multiple of
// 16 for the skip connections to line up.
export const UNET_STRIDE = 16;

export type PaddedRgb = { rgb: Float32Array; width: number; height: number };

// RGBA bytes to the network's input: RGB floats in 0..1.
export function rgbOf(rgba: Uint8ClampedArray): Float32Array {
  const n = rgba.length / 4;
  const rgb = new Float32Array(n * 3);
  for (let p = 0; p < n; p += 1) {
    rgb[p * 3] = rgba[p * 4]! / 255;
    rgb[p * 3 + 1] = rgba[p * 4 + 1]! / 255;
    rgb[p * 3 + 2] = rgba[p * 4 + 2]! / 255;
  }
  return rgb;
}

// Pads RGB right and down to the stride by repeating the last column and row:
// a band of black there would read as a seam along the frame's edge.
export function padToStride(
  rgb: Float32Array,
  width: number,
  height: number,
  stride: number = UNET_STRIDE,
): PaddedRgb {
  const pw = Math.ceil(width / stride) * stride;
  const ph = Math.ceil(height / stride) * stride;
  const out = new Float32Array(pw * ph * 3);
  for (let y = 0; y < ph; y += 1) {
    const sy = Math.min(height - 1, y);
    for (let x = 0; x < pw; x += 1) {
      const s = (sy * width + Math.min(width - 1, x)) * 3;
      const o = (y * pw + x) * 3;
      out[o] = rgb[s]!;
      out[o + 1] = rgb[s + 1]!;
      out[o + 2] = rgb[s + 2]!;
    }
  }
  return { rgb: out, width: pw, height: ph };
}

// The top-left width × height of a padded, channels-last output.
export function cropFromStride(
  padded: Float32Array,
  paddedWidth: number,
  width: number,
  height: number,
  channels = 3,
): Float32Array {
  const out = new Float32Array(width * height * channels);
  const row = width * channels;
  for (let y = 0; y < height; y += 1) {
    const from = y * paddedWidth * channels;
    out.set(padded.subarray(from, from + row), y * row);
  }
  return out;
}
