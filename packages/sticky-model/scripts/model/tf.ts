import './node-util-shim';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import type * as Tf from '@tensorflow/tfjs';
import { WORK_DIR } from '../paths';

// TensorFlow in Node: the native CPU build by default, the CUDA build with
// STICKY_MODEL_GPU=1. Both are installed outside the workspace by
// `scripts/install-tfjs-node.sh` (they download libtensorflow at install
// time), and loaded from there; the workspace depends only on the pure
// JavaScript `@tensorflow/tfjs`, for its types. The GPU build is
// libtensorflow 2.9, which needs CUDA 11 / cuDNN 8 on LD_LIBRARY_PATH
// (`scripts/with-gpu.sh`).
const gpu = process.env.STICKY_MODEL_GPU === '1';
const dir = process.env.STICKY_MODEL_TF_DIR ?? `${WORK_DIR}/tfjs`;
const name = gpu ? '@tensorflow/tfjs-node-gpu' : '@tensorflow/tfjs-node';

if (!existsSync(`${dir}/node_modules/${name}`)) {
  throw new Error(
    `${name} is not installed in ${dir}. Run scripts/install-tfjs-node.sh${gpu ? ' --gpu' : ''} first.`,
  );
}

export const tf = createRequire(`${dir}/`)(name) as typeof Tf;

export type * as TfNode from '@tensorflow/tfjs';
