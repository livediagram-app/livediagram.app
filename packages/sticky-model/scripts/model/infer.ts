import { CLASS } from '../../src/mask';
import { resizeChannels } from '../../src/resize';
import { tf, type TfNode } from './tf';
import { UNET_STRIDE } from './unet';

export type InferOptions = {
  // Run the model on the photo scaled by this much (1 = the working size),
  // then bring the probabilities back: small notes get more pixels.
  scale?: number;
  // Average over the four mirror images of the photo.
  flips?: boolean;
};

// One pass over a float RGB image: pad to the network's stride (edge pixels
// repeated, so the frame's edge is not a seam), predict, crop back.
function predictOnce(
  model: TfNode.LayersModel,
  rgb: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const pw = Math.ceil(width / UNET_STRIDE) * UNET_STRIDE;
  const ph = Math.ceil(height / UNET_STRIDE) * UNET_STRIDE;
  const x = new Float32Array(pw * ph * 3);
  for (let y = 0; y < ph; y += 1) {
    const sy = Math.min(height - 1, y);
    for (let xx = 0; xx < pw; xx += 1) {
      const s = (sy * width + Math.min(width - 1, xx)) * 3;
      const o = (y * pw + xx) * 3;
      x[o] = rgb[s]!;
      x[o + 1] = rgb[s + 1]!;
      x[o + 2] = rgb[s + 2]!;
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
  let rgb: Float32Array = new Float32Array(width * height * 3);
  for (let p = 0; p < width * height; p += 1) {
    rgb[p * 3] = rgba[p * 4]! / 255;
    rgb[p * 3 + 1] = rgba[p * 4 + 1]! / 255;
    rgb[p * 3 + 2] = rgba[p * 4 + 2]! / 255;
  }
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
