import { CLASS } from '../../src/mask';
import { tf, type TfNode } from './tf';
import { UNET_STRIDE } from './unet';

// Run the boundary model over a whole working-size photograph: pad to the
// network's stride, predict, crop back. Returns the three class
// probabilities per pixel.
export function predictProbs(
  model: TfNode.LayersModel,
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const pw = Math.ceil(width / UNET_STRIDE) * UNET_STRIDE;
  const ph = Math.ceil(height / UNET_STRIDE) * UNET_STRIDE;
  const x = new Float32Array(pw * ph * 3);
  for (let y = 0; y < ph; y += 1) {
    // Edge pixels repeated into the padding, so the frame's edge is not a seam.
    const sy = Math.min(height - 1, y);
    for (let xx = 0; xx < pw; xx += 1) {
      const sx = Math.min(width - 1, xx);
      const s = (sy * width + sx) * 4;
      const o = (y * pw + xx) * 3;
      x[o] = rgba[s]! / 255;
      x[o + 1] = rgba[s + 1]! / 255;
      x[o + 2] = rgba[s + 2]! / 255;
    }
  }
  const padded = tf.tidy(() => {
    const out = model.predict(tf.tensor4d(x, [1, ph, pw, 3])) as TfNode.Tensor;
    return out.dataSync() as Float32Array;
  });
  const probs = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    probs.set(padded.subarray(y * pw * 3, y * pw * 3 + width * 3), y * width * 3);
  }
  return probs;
}

// Probabilities to classes. A pixel is core when the model's core
// probability clears `coreThreshold` (0.5 is roughly the argmax); a lower bar
// grows cores, a higher one shrinks them apart.
export function classesOf(probs: Float32Array, coreThreshold: number): Uint8Array {
  const n = probs.length / 3;
  const classes = new Uint8Array(n);
  for (let p = 0; p < n; p += 1) {
    const bg = probs[p * 3]!;
    const core = probs[p * 3 + 1]!;
    const seam = probs[p * 3 + 2]!;
    classes[p] = core >= coreThreshold ? CLASS.core : seam > bg ? CLASS.seam : CLASS.background;
  }
  return classes;
}
