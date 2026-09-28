// WebP encoding with an on-demand WASM fallback
// (docs/specs/020-import-export/import-image-pipeline.md "The encoding policy").
//
// A canvas asked for an unsupported type hands back a PNG instead (Safari does
// this for WebP), so support is detected by the TYPE of the blob the canvas
// returns, never by user agent. Without native support the pixels go to a
// WASM build of libwebp, loaded only then and only once. The decision is pure
// here; browser.ts supplies the canvas and the loader.

export type Pixels = { data: Uint8ClampedArray; width: number; height: number };

export type WasmWebpEncode = (
  pixels: Pixels,
  options: { quality: number },
) => Promise<ArrayBuffer | Uint8Array>;

type EncodeArgs = {
  // The canvas's own attempt at WebP; null when the canvas refused.
  encodeNative: () => Promise<Blob | null>;
  // The drawn pixels; null when the canvas cannot be read (tainted).
  readPixels: () => Pixels | null;
  // 0..1, as the canvas takes it.
  quality: number;
};

export type WebpEncoder = { encode(args: EncodeArgs): Promise<Blob | null> };

export function createWebpEncoder(deps: {
  loadWasm: () => Promise<WasmWebpEncode>;
  log: (fingerprint: string, outcome: string, detail?: unknown) => void;
}): WebpEncoder {
  // undefined until a canvas has answered with a blob.
  let nativeSupported: boolean | undefined;
  let wasm: Promise<WasmWebpEncode> | null = null;

  const loadWasm = () => {
    // A failed load is not cached: the next image tries again.
    wasm ??= deps.loadWasm().catch((error: unknown) => {
      wasm = null;
      throw error;
    });
    return wasm;
  };

  return {
    async encode({ encodeNative, readPixels, quality }) {
      if (nativeSupported !== false) {
        const native = await encodeNative();
        if (!native) return null;
        nativeSupported = native.type === 'image/webp';
        if (nativeSupported) return native;
      }
      const pixels = readPixels();
      if (!pixels) return null;
      let encode: WasmWebpEncode;
      try {
        encode = await loadWasm();
      } catch (error) {
        deps.log('[import-images]', 'webp-wasm-unavailable', { error: String(error) });
        return null;
      }
      try {
        const bytes = await encode(pixels, { quality: Math.round(quality * 100) });
        deps.log('[import-images]', 'webp-wasm', { width: pixels.width, height: pixels.height });
        return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/webp' });
      } catch (error) {
        deps.log('[import-images]', 'webp-wasm-failed', { error: String(error) });
        return null;
      }
    },
  };
}
