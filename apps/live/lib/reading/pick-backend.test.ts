import { describe, expect, it } from 'vitest';
import { pickBackend } from './pick-backend';

// Which engine the in-browser reader runs on, and — when it is the processor —
// WHY (docs/specs/021-event-storming/event-storming.md Phase 9): reading there is minutes on a big wall, not seconds,
// and the author should know it is the machine, not the import.
describe('pickBackend', () => {
  const adapter = (features: string[], info: Record<string, unknown> = {}, extra = {}) => ({
    requestAdapter: async () => ({ features: new Set(features), info, ...extra }),
  });

  it('reads on the graphics card in half precision when it has it', async () => {
    expect(await pickBackend(adapter(['shader-f16']))).toEqual({ backend: 'webgpu', f16: true });
  });

  it('reads on the graphics card in full precision when it has no half precision', async () => {
    // Measured on an RTX 4090 in Linux Chromium (no shader-f16): the same
    // answers as the processor, 18 times faster.
    expect(await pickBackend(adapter([], { vendor: 'nvidia', architecture: 'lovelace' }))).toEqual({
      backend: 'webgpu',
      f16: false,
    });
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

  // A software adapter emulates a GPU on the processor, far slower than the
  // processor path itself: not one note in 13 minutes, measured.
  it.each([
    ['a fallback adapter', adapter([], { isFallbackAdapter: true })],
    ['an adapter that calls itself a fallback', adapter([], {}, { isFallbackAdapter: true })],
    ['SwiftShader', adapter([], { vendor: 'google', architecture: 'swiftshader' })],
  ])('counts %s as no graphics card', async (_, gpu) => {
    expect(await pickBackend(gpu)).toEqual({ backend: 'wasm', why: 'no-adapter' });
  });
});
