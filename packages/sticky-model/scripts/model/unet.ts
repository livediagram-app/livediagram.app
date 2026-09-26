import { tf, type TfNode as T } from './tf';

// The boundary model (experiment E2): a small U-Net that labels every pixel
// background, note core or seam. Plain convolutions at the two finest scales,
// where the seams are a few pixels wide and the channel counts are small;
// depthwise-separable (MobileNet-style) convolutions below, where the channels
// are many and the pixels few. Fully convolutional: any input whose sides are
// a multiple of 16.

export type UNetConfig = {
  // Channels per scale, finest first; one entry per scale, five scales.
  widths: [number, number, number, number, number];
  // Depthwise-separable convolutions at the two finest scales as well (all but
  // the first layer): about a quarter of the multiply-adds, for a browser.
  slim?: boolean;
};

export const DEFAULT_UNET: UNetConfig = { widths: [16, 24, 40, 64, 96] };

type Layer = T.SymbolicTensor;

function conv(x: Layer, filters: number, name: string): Layer {
  const y = tf.layers
    .conv2d({ filters, kernelSize: 3, padding: 'same', useBias: false, name })
    .apply(x) as Layer;
  const n = tf.layers.batchNormalization({ name: `${name}_bn` }).apply(y) as Layer;
  return tf.layers.reLU({ name: `${name}_relu` }).apply(n) as Layer;
}

function sep(x: Layer, filters: number, name: string): Layer {
  const y = tf.layers
    .separableConv2d({
      filters,
      kernelSize: 3,
      padding: 'same',
      useBias: false,
      name,
    })
    .apply(x) as Layer;
  const n = tf.layers.batchNormalization({ name: `${name}_bn` }).apply(y) as Layer;
  return tf.layers.reLU({ name: `${name}_relu` }).apply(n) as Layer;
}

const pool = (x: Layer, name: string) =>
  tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name }).apply(x) as Layer;

const up = (x: Layer, name: string) =>
  tf.layers.upSampling2d({ size: [2, 2], interpolation: 'bilinear', name }).apply(x) as Layer;

const join = (a: Layer, b: Layer, name: string) =>
  tf.layers.concatenate({ name }).apply([a, b]) as Layer;

export function buildUNet(config: UNetConfig = DEFAULT_UNET): T.LayersModel {
  const [w0, w1, w2, w3, w4] = config.widths;
  const fine = config.slim ? sep : conv;
  const input = tf.input({ shape: [null, null, 3], name: 'image' });
  const s0 = fine(conv(input, w0, 'e0a'), w0, 'e0b');
  const s1 = fine(fine(pool(s0, 'p1'), w1, 'e1a'), w1, 'e1b');
  const s2 = sep(sep(pool(s1, 'p2'), w2, 'e2a'), w2, 'e2b');
  const s3 = sep(sep(pool(s2, 'p3'), w3, 'e3a'), w3, 'e3b');
  const b = sep(sep(pool(s3, 'p4'), w4, 'b_a'), w4, 'b_b');
  const d3 = sep(sep(join(up(b, 'u3'), s3, 'c3'), w3, 'd3a'), w3, 'd3b');
  const d2 = sep(sep(join(up(d3, 'u2'), s2, 'c2'), w2, 'd2a'), w2, 'd2b');
  const d1 = fine(join(up(d2, 'u1'), s1, 'c1'), w1, 'd1a');
  const d0 = fine(join(up(d1, 'u0'), s0, 'c0'), w0, 'd0a');
  const out = tf.layers
    .conv2d({ filters: 3, kernelSize: 1, activation: 'softmax', name: 'classes' })
    .apply(d0) as Layer;
  return tf.model({ inputs: input, outputs: out, name: 'sticky_boundary_unet' });
}

// Cross-entropy with the class weights and the ignore mask folded into the
// target: `yTrue` is one-hot scaled by each pixel's weight, all zeros where a
// pixel is not to be learnt from.
export function weightedCrossEntropy(yTrue: T.Tensor, yPred: T.Tensor): T.Scalar {
  return tf.tidy(() => {
    const logp = tf.log(tf.clipByValue(yPred, 1e-6, 1));
    const perPixel = tf.neg(tf.sum(tf.mul(yTrue, logp), -1));
    return tf.mean(perPixel) as T.Scalar;
  });
}
