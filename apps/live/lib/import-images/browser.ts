// The browser half of the import image pipeline: the canvas codec and the
// session wired to the api and Offline Mode
// (docs/specs/020-import-export/blueprints/import-image-pipeline.md "Interfaces and contracts").
// Proven end to end in the running editor; everything it composes is unit-tested.

import { sha256Hex } from '@livediagram/api-schema';
import { apiUploadImage } from '../api/images';
import { isOfflineIdSync } from '../offline/offline-store';
import { createImportImageSession } from './session';
import type { DecodedImage, ImageCodec, ImportImageSession } from './types';

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

async function encode(
  image: DecodedImage,
  width: number,
  height: number,
  type: string,
  quality: number,
): Promise<Blob | null> {
  const { source } = image as BrowserDecoded;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, width, height);
      return await canvas.convertToBlob({ type, quality });
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  } catch {
    // A tainted canvas (an SVG with foreignObject in some engines) refuses to export.
    return null;
  }
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
