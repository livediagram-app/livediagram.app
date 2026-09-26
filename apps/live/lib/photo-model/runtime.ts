import { cropFromStride, padToStride, rgbOf } from '@livediagram/sticky-model';
import type { BoundaryBackend, BoundaryFailure } from './protocol';
import modelJson from './weights/model.json';

// The boundary model's runtime, inside the worker (docs/specs/021-event-storming/event-storming.md Phase 9): the
// TensorFlow.js core, its layers API and ONE backend, all imported on demand so
// only what this browser can run is fetched, and the weights beside them.
//
// The weights are synthetic-only (group E's generator and seeds; nothing
// derived from a photograph), stored a byte a tensor as TensorFlow.js
// dequantises on load: `packages/sticky-model/scripts/hybrid/quantise.ts
// --min-elements 0` over the `synth-v1` model. The graph is `model.json`,
// bundled into this chunk; the bytes are a hashed static asset.
const WEIGHTS_URL = new URL('./weights/weights.bin', import.meta.url);
// All three, though one thread never fetches the threaded build: the backend
// refuses a map that leaves any out.
const WASM_URLS = {
  'tfjs-backend-wasm.wasm': new URL(
    '@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm',
    import.meta.url,
  ).href,
  'tfjs-backend-wasm-simd.wasm': new URL(
    '@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-simd.wasm',
    import.meta.url,
  ).href,
  'tfjs-backend-wasm-threaded-simd.wasm': new URL(
    '@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-threaded-simd.wasm',
    import.meta.url,
  ).href,
};

export class BoundaryRuntimeError extends Error {
  readonly reason: BoundaryFailure;

  constructor(reason: BoundaryFailure, detail: string) {
    super(detail);
    this.reason = reason;
    this.name = 'BoundaryRuntimeError';
  }
}

export type BoundaryRuntime = {
  backend: BoundaryBackend;
  // Class probabilities (background, core, seam) per pixel of a working-size
  // RGBA image, framed exactly as the Node scripts frame it.
  predict: (rgba: Uint8ClampedArray, width: number, height: number) => Promise<Float32Array>;
};

type Tf = typeof import('@tensorflow/tfjs-core');

type Gpu = { requestAdapter: () => Promise<unknown> };

async function startWebGpu(tf: Tf): Promise<boolean> {
  const gpu = (navigator as unknown as { gpu?: Gpu }).gpu;
  if (!gpu) return false;
  try {
    // A browser can expose WebGPU and still have no adapter (headless, a
    // blocklisted driver); asking first spares it the backend's download.
    if (!(await gpu.requestAdapter())) {
      console.info('[photo-model] no WebGPU adapter, trying WASM');
      return false;
    }
    await import('@tensorflow/tfjs-backend-webgpu');
    return (await tf.setBackend('webgpu')) && (await tf.ready(), true);
  } catch (err) {
    console.info('[photo-model] WebGPU unavailable, trying WASM', String(err));
    return false;
  }
}

async function startWasm(tf: Tf): Promise<boolean> {
  try {
    const wasm = await import('@tensorflow/tfjs-backend-wasm');
    // One thread: threads need the whole app cross-origin isolated.
    tf.env().set('WASM_HAS_MULTITHREAD_SUPPORT', false);
    wasm.setWasmPaths(WASM_URLS);
    return (await tf.setBackend('wasm')) && (await tf.ready(), true);
  } catch (err) {
    console.info('[photo-model] WASM unavailable', String(err));
    return false;
  }
}

async function pickBackend(tf: Tf): Promise<BoundaryBackend> {
  if (await startWebGpu(tf)) return 'webgpu';
  if (await startWasm(tf)) return 'wasm';
  throw new BoundaryRuntimeError('no-backend', 'neither WebGPU nor WASM initialised');
}

async function loadModel() {
  const { loadLayersModel } = await import('@tensorflow/tfjs-layers');
  const response = await fetch(WEIGHTS_URL);
  if (!response.ok) throw new Error(`weights: HTTP ${response.status}`);
  const weightData = await response.arrayBuffer();
  const { modelTopology, weightsManifest, format, generatedBy, convertedBy } = modelJson;
  return loadLayersModel({
    load: async () => ({
      modelTopology,
      weightSpecs: weightsManifest.flatMap((group) => group.weights) as never,
      weightData,
      format,
      generatedBy,
      convertedBy: convertedBy ?? undefined,
    }),
  });
}

export async function loadBoundaryRuntime(): Promise<BoundaryRuntime> {
  let tf: Tf;
  try {
    tf = await import('@tensorflow/tfjs-core');
  } catch (err) {
    throw new BoundaryRuntimeError('load-failed', `runtime: ${String(err)}`);
  }
  const backend = await pickBackend(tf);
  let model: Awaited<ReturnType<typeof loadModel>>;
  try {
    model = await loadModel();
  } catch (err) {
    throw new BoundaryRuntimeError('load-failed', String(err));
  }
  return {
    backend,
    async predict(rgba, width, height) {
      const padded = padToStride(rgbOf(rgba), width, height);
      const out = tf.tidy(
        () =>
          model.predict(
            tf.tensor4d(padded.rgb, [1, padded.height, padded.width, 3]),
          ) as import('@tensorflow/tfjs-core').Tensor,
      );
      try {
        const probs = (await out.data()) as Float32Array;
        return cropFromStride(probs, padded.width, width, height);
      } finally {
        out.dispose();
      }
    },
  };
}
