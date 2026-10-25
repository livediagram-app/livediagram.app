import type { Override } from '@liveworkspace/licences/tables';

// Texts for exact package versions this product ships that carry no licence file
// (docs/specs/002-project-scope/third-party-licences.md "Licence texts"), keyed to the version.
const TFJS = [
  { label: 'LICENSE (tensorflow/tfjs 4.22.0)', file: 'tensorflow-tfjs-4.22.0-LICENSE.txt' },
];

export const OVERRIDES: readonly Override[] = [
  { package: '@tensorflow/tfjs-core', version: '4.22.0', texts: TFJS },
  { package: '@tensorflow/tfjs-backend-cpu', version: '4.22.0', texts: TFJS },
  { package: '@tensorflow/tfjs-backend-wasm', version: '4.22.0', texts: TFJS },
  { package: '@tensorflow/tfjs-backend-webgpu', version: '4.22.0', texts: TFJS },
  {
    package: '@tensorflow/tfjs-layers',
    version: '4.22.0',
    texts: [
      {
        label: 'LICENSE (tensorflow/tfjs-layers 4.22.0)',
        file: 'tensorflow-tfjs-layers-4.22.0-LICENSE.txt',
      },
    ],
  },
  {
    package: 'onnxruntime-common',
    version: '1.21.0',
    texts: [{ label: 'LICENSE (onnxruntime 1.21.0)', file: 'onnxruntime-1.21.0-LICENSE.txt' }],
  },
  {
    package: 'onnxruntime-web',
    version: '1.22.0-dev.20250409-89f8206ba4',
    texts: [{ label: 'LICENSE (onnxruntime 89f8206)', file: 'onnxruntime-89f8206ba4-LICENSE.txt' }],
  },
  {
    package: 'seedrandom',
    version: '3.0.5',
    texts: [
      {
        label: 'LICENSE (seedrandom 3.0.5 README and lib/alea.js)',
        file: 'seedrandom-3.0.5-LICENSE.txt',
      },
    ],
  },
  {
    package: '@resvg/resvg-wasm',
    version: '2.6.2',
    texts: [{ label: 'LICENSE (resvg-js 2.6.2)', file: 'resvg-js-2.6.2-LICENSE.txt' }],
  },
];
