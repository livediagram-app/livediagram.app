import type { ProcessorReason } from './reader-protocol';

// Which engine the in-browser reader runs on (spec/139 Phase 9), and — when it
// is the processor — why.
//
// The graphics card only when it can run the half-precision weights the WebGPU
// path asks for: the adapter reports a GPU either way, so ask for the feature.
// Everything else reads on the processor, and the reason travels with it,
// because a big wall there is minutes rather than seconds.

type Gpu = { requestAdapter(): Promise<{ features: Set<string> } | null> };

export type BackendChoice = { backend: 'webgpu' } | { backend: 'wasm'; why: ProcessorReason };

export async function pickBackend(gpu: Gpu | undefined): Promise<BackendChoice> {
  if (!gpu) return { backend: 'wasm', why: 'no-webgpu' };
  let adapter: { features: Set<string> } | null;
  try {
    adapter = await gpu.requestAdapter();
  } catch {
    adapter = null;
  }
  if (!adapter) return { backend: 'wasm', why: 'no-adapter' };
  return adapter.features.has('shader-f16')
    ? { backend: 'webgpu' }
    : { backend: 'wasm', why: 'no-f16' };
}
