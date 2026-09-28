// Test doubles for the pipeline's DOM seam (not shipped: imported by tests only).

import type { DecodedImage, ImageCodec } from './types';

export const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
export const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1];
export const WEBP_HEAD = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
export const GIF_HEAD = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0];

const HEAD_BY_TYPE: Record<string, number[]> = {
  'image/png': PNG_HEAD,
  'image/jpeg': JPEG_HEAD,
  'image/webp': WEBP_HEAD,
  'image/gif': GIF_HEAD,
};

// A blob of `size` bytes that sniffs as `type`.
export function fakeImageBlob(type: string, size: number): Blob {
  const head = HEAD_BY_TYPE[type] ?? [];
  const bytes = new Uint8Array(Math.max(size, head.length));
  bytes.set(head);
  return new Blob([bytes], { type });
}

export type FakeCodecOptions = {
  // Natural size decode reports; null = the browser can't decode it.
  size?: { width: number; height: number } | null;
  // Bytes an encode returns per output type; null = encode fails.
  encodedSize?: (type: string, width: number, height: number) => number | null;
  // Types the fake browser can encode; others come back as PNG, like a real canvas.
  encodable?: string[];
};

export function fakeCodec(opts: FakeCodecOptions = {}) {
  const calls = {
    decode: 0,
    encode: [] as { type: string; width: number; height: number }[],
    closed: 0,
  };
  const codec: ImageCodec = {
    async decode() {
      calls.decode += 1;
      const size = opts.size === undefined ? { width: 100, height: 100 } : opts.size;
      if (!size) return null;
      const decoded: DecodedImage = { ...size, close: () => void (calls.closed += 1) };
      return decoded;
    },
    async encode(_image, width, height, type) {
      calls.encode.push({ type, width, height });
      const encodable = opts.encodable ?? ['image/webp', 'image/png', 'image/jpeg'];
      const outType = encodable.includes(type) ? type : 'image/png';
      const size = opts.encodedSize ? opts.encodedSize(outType, width, height) : 1000;
      if (size === null) return null;
      return fakeImageBlob(outType, size);
    },
  };
  return { codec, calls };
}
