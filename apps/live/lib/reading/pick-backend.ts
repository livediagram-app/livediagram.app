import type { ProcessorReason } from './reader-protocol';

// Which engine the in-browser reader runs on (spec/139 Phase 9), and — when it
// is the processor — why.
//
// Any real graphics card: in half precision when it has `shader-f16`, in full
// precision when it does not (an RTX 4090 in Linux Chromium has none, and reads
// the same answers there 18 times faster than the processor). A SOFTWARE
// adapter (SwiftShader, a "fallback" adapter) emulates a GPU on the processor
// and is slower than the processor path itself, so it counts as none.

type Adapter = {
  features: Set<string>;
  isFallbackAdapter?: boolean;
  info?: { isFallbackAdapter?: boolean; vendor?: string; architecture?: string };
};
type Gpu = { requestAdapter(): Promise<Adapter | null> };

export type BackendChoice =
  { backend: 'webgpu'; f16: boolean } | { backend: 'wasm'; why: ProcessorReason };

const isSoftware = (adapter: Adapter): boolean =>
  adapter.isFallbackAdapter === true ||
  adapter.info?.isFallbackAdapter === true ||
  /swiftshader/i.test(`${adapter.info?.vendor ?? ''} ${adapter.info?.architecture ?? ''}`);

export async function pickBackend(gpu: Gpu | undefined): Promise<BackendChoice> {
  if (!gpu) return { backend: 'wasm', why: 'no-webgpu' };
  let adapter: Adapter | null;
  try {
    adapter = await gpu.requestAdapter();
  } catch {
    adapter = null;
  }
  if (!adapter || isSoftware(adapter)) return { backend: 'wasm', why: 'no-adapter' };
  return { backend: 'webgpu', f16: adapter.features.has('shader-f16') };
}
