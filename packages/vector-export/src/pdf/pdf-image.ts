// Pictures as PDF image objects (liveworkspace/docs/specs/013-export/vector-pdf.md "Pictures and the fallback"): a JPEG keeps its own bytes
// (DCTDecode, no re-encoding), anything else goes in as FlateDecode RGB with its transparency as a soft mask, and a
// whole page drawn by the old raster path is composited onto white as that path always was.
import type { PdfFile } from './pdf-file';

export type Pixels = { width: number; height: number; data: Uint8ClampedArray };

/** An RGBA picture as an image object with, where any pixel is not opaque, a DeviceGray soft mask. `onWhite` lays
 *  the picture on white instead (no mask), as the whole-page raster always has. */
export function putPixels(file: PdfFile, px: Pixels, onWhite = false): number {
  const n = px.width * px.height;
  const rgb = new Uint8Array(n * 3);
  const alpha = new Uint8Array(n);
  let translucent = false;
  const d = px.data;
  for (let i = 0, j = 0, k = 0; k < n; i += 4, j += 3, k++) {
    const a = d[i + 3]!;
    if (onWhite) {
      const f = a / 255;
      rgb[j] = Math.round(d[i]! * f + 255 * (1 - f));
      rgb[j + 1] = Math.round(d[i + 1]! * f + 255 * (1 - f));
      rgb[j + 2] = Math.round(d[i + 2]! * f + 255 * (1 - f));
    } else {
      rgb[j] = d[i]!;
      rgb[j + 1] = d[i + 1]!;
      rgb[j + 2] = d[i + 2]!;
      alpha[k] = a;
      if (a !== 255) translucent = true;
    }
  }
  const size = `/Width ${px.width} /Height ${px.height} /BitsPerComponent 8`;
  let smask = '';
  if (translucent) {
    const m = file.putStream(
      file.alloc(),
      `/Type /XObject /Subtype /Image ${size} /ColorSpace /DeviceGray`,
      alpha,
    );
    smask = ` /SMask ${m} 0 R`;
  }
  return file.putStream(
    file.alloc(),
    `/Type /XObject /Subtype /Image ${size} /ColorSpace /DeviceRGB${smask}`,
    rgb,
  );
}

/** A JPEG's size and colour components from its frame header, or null when it is not a baseline or progressive
 *  JPEG this writer can pass through (1 or 3 components). */
export function jpegInfo(
  bytes: Uint8Array,
): { width: number; height: number; components: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1]!;
    // Fill bytes before a marker.
    if (marker === 0xff) {
      i++;
      continue;
    }
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    // SOF0 to SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (bytes[i + 5]! << 8) | bytes[i + 6]!;
      const width = (bytes[i + 7]! << 8) | bytes[i + 8]!;
      const components = bytes[i + 9]!;
      if (!width || !height || (components !== 1 && components !== 3)) return null;
      return { width, height, components };
    }
    i += 2 + len;
  }
  return null;
}

/** A JPEG as an image object, its own bytes; null when it can't go in as it is. */
export function putJpeg(
  file: PdfFile,
  bytes: Uint8Array,
): { obj: number; width: number; height: number } | null {
  const info = jpegInfo(bytes);
  if (!info) return null;
  const cs = info.components === 1 ? '/DeviceGray' : '/DeviceRGB';
  const obj = file.putStream(
    file.alloc(),
    `/Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /BitsPerComponent 8 /ColorSpace ${cs}`,
    bytes,
    'DCTDecode',
  );
  return { obj, width: info.width, height: info.height };
}

/** A canvas's pixels. */
export function canvasPixels(canvas: HTMLCanvasElement): Pixels {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF rendering failed: no 2d context');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data: img.data };
}

/** A data: URL's bytes and media type, or null for any other URL. */
export function dataUrlBytes(href: string): { type: string; bytes: Uint8Array } | null {
  if (!href.startsWith('data:')) return null;
  const comma = href.indexOf(',');
  if (comma === -1) return null;
  const meta = href.slice(5, comma);
  const type = meta.split(';')[0]!.toLowerCase();
  const body = href.slice(comma + 1);
  if (meta.endsWith(';base64')) {
    const bin = atob(body);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { type, bytes: out };
  }
  return { type, bytes: new TextEncoder().encode(decodeURIComponent(body)) };
}

/** A picture loaded and drawn onto a canvas of at most `maxW` x `maxH` pixels (its own size when smaller). */
export async function loadPixels(href: string, maxW: number, maxH: number): Promise<Pixels> {
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('PDF: a picture failed to load'));
    img.src = href;
  });
  const nw = img.naturalWidth || maxW;
  const nh = img.naturalHeight || maxH;
  const fit = Math.min(1, maxW / nw, maxH / nh);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(nw * fit));
  canvas.height = Math.max(1, Math.round(nh * fit));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF rendering failed: no 2d context');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvasPixels(canvas);
}
