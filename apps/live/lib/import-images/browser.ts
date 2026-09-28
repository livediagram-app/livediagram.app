// The browser half of the import image pipeline: the canvas codec and the
// session wired to the api and Offline Mode
// (docs/specs/020-import-export/blueprints/import-image-pipeline.md "Interfaces and contracts").
// Proven end to end in the running editor; everything it composes is unit-tested.

import { sha256Hex } from '@livediagram/api-schema';
import { apiUploadImage } from '../api/images';
import { isOfflineIdSync } from '../offline/offline-store';
import { createImportImageSession } from './session';
import type { DecodedImage, ImageCodec, ImportImageSession } from './types';
import { createWebpEncoder, type WasmWebpEncode } from './webp';

type Drawable = ImageBitmap | HTMLImageElement;
type BrowserDecoded = DecodedImage & { source: Drawable };

// SVG goes through an <img>: scripts never run and external references never
// load there. Its natural size may be 0 when the SVG declares none.
function decodeSvg(blob: Blob): Promise<BrowserDecoded | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

async function decodeRaster(blob: Blob): Promise<BrowserDecoded | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  } catch {
    return null;
  }
}

type Canvas2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

// Draw the image at the target size; OffscreenCanvas where there is one.
function draw(
  source: Drawable,
  width: number,
  height: number,
): { ctx: Canvas2D; toBlob: (type: string, quality: number) => Promise<Blob | null> } | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);
    return { ctx, toBlob: (type, quality) => canvas.convertToBlob({ type, quality }) };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return {
    ctx,
    toBlob: (type, quality) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality)),
  };
}

// A tainted canvas (an SVG with foreignObject in some engines) refuses to export
// or to be read; both surface as null.
const orNull = async <T>(run: () => Promise<T | null> | T | null): Promise<T | null> => {
  try {
    return await run();
  } catch {
    return null;
  }
};

// libwebp as WASM (@jsquash/webp, Apache-2.0; libwebp BSD-3-Clause), fetched
// only when a canvas cannot encode WebP itself: its own chunk and .wasm asset.
const webpEncoder = createWebpEncoder({
  loadWasm: async () => (await import('@jsquash/webp/encode')).default as WasmWebpEncode,
  log: (fingerprint, outcome, detail) => console.info(fingerprint, outcome, detail),
});

async function encode(
  image: DecodedImage,
  width: number,
  height: number,
  type: string,
  quality: number,
): Promise<Blob | null> {
  const drawn = await orNull(() => draw((image as BrowserDecoded).source, width, height));
  if (!drawn) return null;
  if (type !== 'image/webp') return orNull(() => drawn.toBlob(type, quality));
  return webpEncoder.encode({
    encodeNative: () => orNull(() => drawn.toBlob(type, quality)),
    readPixels: () => {
      try {
        return drawn.ctx.getImageData(0, 0, width, height);
      } catch {
        return null;
      }
    },
    quality,
  });
}

export const browserImageCodec: ImageCodec = {
  decode: (blob, mimeType) => (mimeType === 'image/svg+xml' ? decodeSvg(blob) : decodeRaster(blob)),
  encode,
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('image read failed'));
    reader.readAsDataURL(blob);
  });
}

// One session per import: cloud diagrams upload to the owner's gallery,
// Offline Mode diagrams embed (docs/specs/006-diagram/offline-mode.md).
export function createBrowserImportImageSession({
  ownerId,
  diagramId,
}: {
  ownerId: string;
  diagramId: string | null;
}): ImportImageSession {
  return createImportImageSession({
    offline: !!diagramId && isOfflineIdSync(diagramId),
    codec: browserImageCodec,
    toDataUrl: blobToDataUrl,
    upload: async (prepared, name) => {
      const bytes = await prepared.blob.arrayBuffer();
      const { image, deduped } = await apiUploadImage(ownerId, {
        bytes,
        contentType: prepared.mimeType,
        sha256: await sha256Hex(bytes),
        width: prepared.width,
        height: prepared.height,
        originalName: name,
      });
      return { imageId: image.id, deduped };
    },
  });
}
