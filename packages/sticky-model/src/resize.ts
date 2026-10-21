// Bilinear resize of an interleaved multi-channel float image, pixel centres
// aligned (the half-pixel convention), edges clamped. Used to run the model
// at another scale and bring its probabilities back to the working size.
export function resizeChannels(
  src: Float32Array,
  width: number,
  height: number,
  channels: number,
  outWidth: number,
  outHeight: number,
): Float32Array {
  const out = new Float32Array(outWidth * outHeight * channels);
  const sx = width / outWidth;
  const sy = height / outHeight;
  for (let y = 0; y < outHeight; y += 1) {
    const fy = Math.min(height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(height - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < outWidth; x += 1) {
      const fx = Math.min(width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(width - 1, x0 + 1);
      const tx = fx - x0;
      for (let c = 0; c < channels; c += 1) {
        const a = src[(y0 * width + x0) * channels + c]!;
        const b = src[(y0 * width + x1) * channels + c]!;
        const d = src[(y1 * width + x0) * channels + c]!;
        const e = src[(y1 * width + x1) * channels + c]!;
        out[(y * outWidth + x) * channels + c] =
          (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
      }
    }
  }
  return out;
}
