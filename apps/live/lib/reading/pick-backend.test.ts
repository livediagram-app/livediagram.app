import { describe, expect, it } from 'vitest';
import { pickBackend } from './pick-backend';

// Which engine the in-browser reader runs on, and — when it is the processor —
// WHY (spec/139 Phase 9): reading there is minutes on a big wall, not seconds,
// and the author should know it is the machine, not the import.
describe('pickBackend', () => {
  const adapter = (features: string[]) => ({
    requestAdapter: async () => ({ features: new Set(features) }),
  });

  it('reads on the graphics card when it can run half-precision maths', async () => {
    expect(await pickBackend(adapter(['shader-f16']))).toEqual({ backend: 'webgpu' });
  });

  it('says the browser has no WebGPU', async () => {
    expect(await pickBackend(undefined)).toEqual({ backend: 'wasm', why: 'no-webgpu' });
  });

  it('says there is no graphics adapter', async () => {
    expect(await pickBackend({ requestAdapter: async () => null })).toEqual({
      backend: 'wasm',
      why: 'no-adapter',
    });
  });

  it('counts an adapter request that throws as no adapter', async () => {
    const gpu = {
      requestAdapter: async () => {
        throw new Error('denied');
      },
    };
    expect(await pickBackend(gpu)).toEqual({ backend: 'wasm', why: 'no-adapter' });
  });

  it('says the graphics card cannot run the half-precision maths', async () => {
    expect(await pickBackend(adapter([]))).toEqual({ backend: 'wasm', why: 'no-f16' });
  });
});
