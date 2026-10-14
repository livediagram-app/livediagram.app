import type { GifPalette } from 'gifenc';
import { createGifWriter, pagePalette, type GifWriter } from './gif-encode-core';
import type { GifEncodeRequest, GifEncodeResponse } from './gif-encode-protocol';

// The GIF export's encoder worker (docs/specs/020-import-export/blueprints/animated-gif-export.md "The encoder"):
// quantising and compressing every frame off the main thread, so the editor stays responsive while a GIF is made.

const scope = self as unknown as {
  postMessage: (message: GifEncodeResponse, transfer?: Transferable[]) => void;
  addEventListener: (type: 'message', fn: (e: MessageEvent<GifEncodeRequest>) => void) => void;
};

let writer: GifWriter | null = null;
// The pages' palettes, by key.
const palettes = new Map<number, GifPalette>();
let size = { width: 0, height: 0 };

scope.addEventListener('message', ({ data }) => {
  try {
    if (data.type === 'start') {
      size = { width: data.width, height: data.height };
      writer = createGifWriter(data.width, data.height);
      palettes.clear();
    } else if (data.type === 'palette') {
      palettes.set(data.key, pagePalette(data.samples.map((b) => new Uint8ClampedArray(b))));
    } else if (data.type === 'frame') {
      const palette = data.palette === undefined ? undefined : palettes.get(data.palette);
      writer?.add(new Uint8ClampedArray(data.rgba), data.delayCs, palette);
    } else if (writer) {
      const bytes = writer.finish();
      const written = writer.written;
      writer = null;
      const out = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      scope.postMessage({ type: 'done', bytes: out as ArrayBuffer, written }, [out as ArrayBuffer]);
    }
  } catch (err) {
    writer = null;
    scope.postMessage({ type: 'failed', message: `${size.width}x${size.height}: ${String(err)}` });
  }
});
