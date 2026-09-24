import type { NamedAttrMap, Tensor } from '@tensorflow/tfjs';
import { tf } from './tf';

// tfjs-core's gradients of Sum and Mean broadcast the incoming gradient by
// multiplying with `ones(x.shape)`, and `ones` fills a JavaScript array the
// size of the activation and uploads it. Every BatchNorm layer reduces a full
// feature map, so a training step spent most of its time filling arrays: 0.9 s
// a batch on a GPU that runs the convolutions in a few milliseconds. The same
// gradients re-registered with the device-side `onesLike`. ReLU's gradient
// goes through tfjs-node's `Step` kernel, which builds the same JavaScript
// `ones`, so it is re-registered as a comparison and a cast instead.

function axesOf(attrs: NamedAttrMap, rank: number): number[] {
  const axis = attrs.axis as number | number[] | null | undefined;
  const list = axis === null || axis === undefined ? [...Array(rank).keys()] : [axis].flat();
  return list.map((a) => (a < 0 ? a + rank : a));
}

function broadcastBack(dy: Tensor, x: Tensor, attrs: NamedAttrMap): Tensor {
  const shape = x.shape.slice();
  for (const a of axesOf(attrs, x.rank)) shape[a] = 1;
  return tf.mul(tf.reshape(dy, shape), tf.onesLike(x));
}

export function registerFastGradients(): void {
  tf.registerGradient({
    kernelName: 'Relu',
    inputsToSave: ['x'],
    gradFunc: (dy, saved) => {
      const [x] = saved as Tensor[];
      return { x: () => tf.mul(dy as Tensor, tf.cast(tf.greater(x!, 0), 'float32')) };
    },
  });
  tf.registerGradient({
    kernelName: 'Sum',
    inputsToSave: ['x'],
    gradFunc: (dy, saved, attrs) => {
      const [x] = saved as Tensor[];
      return { x: () => broadcastBack(dy as Tensor, x!, attrs) };
    },
  });
  tf.registerGradient({
    kernelName: 'Mean',
    inputsToSave: ['x'],
    gradFunc: (dy, saved, attrs) => {
      const [x] = saved as Tensor[];
      const axes = axesOf(attrs, x!.rank);
      const count = axes.reduce((n, a) => n * x!.shape[a]!, 1);
      return { x: () => tf.div(broadcastBack(dy as Tensor, x!, attrs), count) };
    },
  });
}
