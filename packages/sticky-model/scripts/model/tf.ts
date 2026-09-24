import './node-util-shim';
import type * as TfNode from '@tensorflow/tfjs-node';

// TensorFlow in Node: the CPU build by default, the CUDA build with
// STICKY_MODEL_GPU=1. The GPU build is libtensorflow 2.9, which needs the
// CUDA 11 / cuDNN 8 libraries on LD_LIBRARY_PATH (see the package README).
const gpu = process.env.STICKY_MODEL_GPU === '1';

export const tf: typeof TfNode = gpu
  ? ((await import('@tensorflow/tfjs-node-gpu')) as unknown as typeof TfNode)
  : await import('@tensorflow/tfjs-node');

export type { TfNode };
