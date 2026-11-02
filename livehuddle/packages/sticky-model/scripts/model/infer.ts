import { CLASS } from '../../src/mask';
import { resizeChannels } from '../../src/resize';
import { cropFromStride, padToStride, rgbOf } from '../../src/stride';
import { tf, type TfNode } from './tf';

export type InferOptions = {
  // Run the model on the photo scaled by this much (1 = the working size),
  // then bring the probabilities back: small notes get more pixels.
  scale?: number;
  // Average over the four mirror images of the photo.
  flips?: boolean;
};

// One pass over a float RGB image, framed by `stride.ts` exactly as the
// browser frames it.
function predictOnce(
  model: TfNode.LayersModel,
  rgb: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const padded = padToStride(rgb, width, height);
  const out = tf.tidy(() => {
    const y = model.predict(
      tf.tensor4d(padded.rgb, [1, padded.height, padded.width, 3]),
    ) as TfNode.Tensor;
    return y.dataSync() as Float32Array;
  });
  return cropFromStride(out, padded.width, width, height);
}

function mirror(
  src: Float32Array,
  width: number,
  height: number,
  fx: boolean,
  fy: boolean,
): Float32Array {
  if (!fx && !fy) return src;
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y += 1) {
    const sy = fy ? height - 1 - y : y;
    for (let x = 0; x < width; x += 1) {
      const sx = fx ? width - 1 - x : x;
      const s = (sy * width + sx) * 3;
      const o = (y * width + x) * 3;
      out[o] = src[s]!;
      out[o + 1] = src[s + 1]!;
      out[o + 2] = src[s + 2]!;
    }
  }
  return out;
}

// The three class probabilities per pixel of a working-size RGBA photo.
export function predictProbs(
  model: TfNode.LayersModel,
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  opts: InferOptions = {},
): Float32Array {
  const scale = opts.scale ?? 1;
  let rgb = rgbOf(rgba.subarray(0, width * height * 4));
  const sw = Math.round(width * scale);
  const sh = Math.round(height * scale);
  if (scale !== 1) rgb = resizeChannels(rgb, width, height, 3, sw, sh);
  const views: [boolean, boolean][] = opts.flips
    ? [
        [false, false],
        [true, false],
        [false, true],
        [true, true],
      ]
    : [[false, false]];
  const sum = new Float32Array(sw * sh * 3);
  for (const [fx, fy] of views) {
    const probs = mirror(predictOnce(model, mirror(rgb, sw, sh, fx, fy), sw, sh), sw, sh, fx, fy);
    for (let i = 0; i < sum.length; i += 1) sum[i]! += probs[i]! / views.length;
  }
  return scale === 1 ? sum : resizeChannels(sum, sw, sh, 3, width, height);
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
