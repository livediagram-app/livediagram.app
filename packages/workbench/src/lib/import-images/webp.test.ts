import { describe, expect, it, vi } from 'vitest';
import { createWebpEncoder, type Pixels } from './webp';

const pixels: Pixels = { data: new Uint8ClampedArray(16), width: 2, height: 2 };
const blob = (type: string) => new Blob([new Uint8Array([1, 2, 3])], { type });

function setup(over: { native?: string | null; wasm?: 'ok' | 'throws' | 'load-fails' } = {}) {
  const encodeNative = vi.fn(async () =>
    over.native === null ? null : blob(over.native ?? 'image/webp'),
  );
  const readPixels = vi.fn(() => pixels);
  const wasmEncode = vi.fn(async () => {
    if (over.wasm === 'throws') throw new Error('Encoding error.');
    return new Uint8Array([9, 9]).buffer;
  });
  const loadWasm = vi.fn(async () => {
    if (over.wasm === 'load-fails') throw new Error('network');
    return wasmEncode;
  });
  const log = vi.fn();
  const encoder = createWebpEncoder({ loadWasm, log });
  return { encoder, encodeNative, readPixels, wasmEncode, loadWasm, log };
}

describe('createWebpEncoder', () => {
  it('uses the canvas when the browser encodes WebP and never loads the WASM encoder', async () => {
    const s = setup();
    const out = await s.encoder.encode({
      encodeNative: s.encodeNative,
      readPixels: s.readPixels,
      quality: 0.85,
    });
    expect(out?.type).toBe('image/webp');
    expect(s.loadWasm).not.toHaveBeenCalled();
  });

  it('detects a browser without WebP encoding by the blob type and encodes with WASM', async () => {
    const s = setup({ native: 'image/png' });
    const out = await s.encoder.encode({
      encodeNative: s.encodeNative,
      readPixels: s.readPixels,
      quality: 0.85,
    });
    expect(out?.type).toBe('image/webp');
    expect(new Uint8Array(await out!.arrayBuffer())).toEqual(new Uint8Array([9, 9]));
    expect(s.wasmEncode).toHaveBeenCalledWith(pixels, { quality: 85 });
    expect(s.log).toHaveBeenCalledWith('[import-images]', 'webp-wasm', { width: 2, height: 2 });
  });

  it('remembers the detection, so later images skip the wasted canvas encode', async () => {
    const s = setup({ native: 'image/png' });
    const args = { encodeNative: s.encodeNative, readPixels: s.readPixels, quality: 0.85 };
    await s.encoder.encode(args);
    await s.encoder.encode(args);
    expect(s.encodeNative).toHaveBeenCalledTimes(1);
    expect(s.loadWasm).toHaveBeenCalledTimes(1);
    expect(s.wasmEncode).toHaveBeenCalledTimes(2);
  });

  it('hands back the non-WebP blob when the WASM encoder cannot load, so the caller falls back', async () => {
    const s = setup({ native: 'image/png', wasm: 'load-fails' });
    const out = await s.encoder.encode({
      encodeNative: s.encodeNative,
      readPixels: s.readPixels,
      quality: 0.85,
    });
    expect(out).toBeNull();
    expect(s.log).toHaveBeenCalledWith(
      '[import-images]',
      'webp-wasm-unavailable',
      expect.anything(),
    );
  });

  it('retries loading the WASM encoder on a later image after a failed load', async () => {
    const s = setup({ native: 'image/png', wasm: 'load-fails' });
    const args = { encodeNative: s.encodeNative, readPixels: s.readPixels, quality: 0.85 };
    await s.encoder.encode(args);
    await s.encoder.encode(args);
    expect(s.loadWasm).toHaveBeenCalledTimes(2);
  });

  it('returns null when the WASM encoder throws', async () => {
    const s = setup({ native: 'image/png', wasm: 'throws' });
    expect(
      await s.encoder.encode({
        encodeNative: s.encodeNative,
        readPixels: s.readPixels,
        quality: 0.85,
      }),
    ).toBeNull();
  });

  it('returns null when the pixels cannot be read (a tainted canvas)', async () => {
    const s = setup({ native: 'image/png' });
    const out = await s.encoder.encode({
      encodeNative: s.encodeNative,
      readPixels: () => null,
      quality: 0.85,
    });
    expect(out).toBeNull();
    expect(s.loadWasm).not.toHaveBeenCalled();
  });

  it('passes a failed canvas encode through without guessing support', async () => {
    const s = setup({ native: null });
    const args = { encodeNative: s.encodeNative, readPixels: s.readPixels, quality: 0.85 };
    expect(await s.encoder.encode(args)).toBeNull();
    await s.encoder.encode(args);
    expect(s.encodeNative).toHaveBeenCalledTimes(2);
    expect(s.loadWasm).not.toHaveBeenCalled();
  });
});
