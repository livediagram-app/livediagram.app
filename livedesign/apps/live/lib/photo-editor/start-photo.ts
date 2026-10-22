// Starting a photo and bringing pictures in (docs/specs/031-photo/photo-pages.md "Making a photo
// page", "Exports and other views" Opening a PSD; photo-layers.md "New Layer from a picture"): a
// picture read (a PSD's layers, or any other picture decoded) and fitted to the pixel cap; a photo
// started from it (its first layer, Background, the picture kept whole as its source when it can be),
// from a PSD, or blank with a fill; and a picture added to a started photo as a new layer.
import { PHOTO_BLOB_TYPES, type PhotoBlobType } from '@livedesign/api-schema';
import {
  blobIdOf,
  createRaster,
  hexToBytes,
  newLayerId,
  PHOTO_MAX_AREA,
  PHOTO_MAX_LAYERS,
  photoFromPsd,
  PsdError,
  readPsd,
  resizeRaster,
  TiledRaster,
  type Photo,
  type PixelLayer,
  type Raster,
} from '@livedesign/photo-engine';
import { pixelCap } from './image-ops';
import { photoWorkers } from './photo-worker-client';
import type { PhotoSession } from './session';

export type Picture = {
  raster: Raster;
  // The file as it came, when it can be kept whole as the layer's source (not scaled, a stored type).
  source?: { bytes: Uint8Array; type: PhotoBlobType };
  // Scaled down to fit the cap.
  scaled: boolean;
};

export type ReadPicture =
  | { kind: 'picture'; picture: Picture }
  | { kind: 'psd'; photo: Photo; pixels: ReturnType<typeof photoFromPsd>['pixels']; scaled: false }
  | { kind: 'refused'; reason: string };

/** The size a picture takes within the cap, keeping its shape. */
export function fitToCap(
  width: number,
  height: number,
  cap = pixelCap(),
): { width: number; height: number; scaled: boolean } {
  const k = Math.min(
    1,
    cap / Math.max(width, height),
    Math.sqrt(PHOTO_MAX_AREA / (width * height)),
  );
  if (k >= 1) return { width, height, scaled: false };
  return {
    width: Math.max(1, Math.floor(width * k)),
    height: Math.max(1, Math.floor(height * k)),
    scaled: true,
  };
}

const isPsd = (b: Uint8Array) =>
  b.length > 4 && b[0] === 0x38 && b[1] === 0x42 && b[2] === 0x50 && b[3] === 0x53;

/** A file read as a picture: a PSD's layers, or the picture decoded and fitted to the cap. */
export async function readPicture(file: Blob): Promise<ReadPicture> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isPsd(bytes)) {
    try {
      const doc = readPsd(bytes);
      const fit = fitToCap(doc.width, doc.height);
      if (fit.scaled)
        return { kind: 'refused', reason: `This PSD is larger than ${pixelCap()} px a side.` };
      const { photo, pixels } = photoFromPsd(doc);
      if (photo.layers.length > PHOTO_MAX_LAYERS)
        return { kind: 'refused', reason: `This PSD has more than ${PHOTO_MAX_LAYERS} layers.` };
      return { kind: 'psd', photo, pixels, scaled: false };
    } catch (err) {
      return {
        kind: 'refused',
        reason: err instanceof PsdError ? err.message : 'This PSD could not be read.',
      };
    }
  }
  let raster: Raster;
  try {
    const res = await photoWorkers().run({
      kind: 'decode',
      bytes: bytes.slice(),
      type: file.type || 'image/png',
    }).result;
    if (res.kind !== 'decode')
      return { kind: 'refused', reason: 'This picture could not be read.' };
    raster = res.raster;
  } catch {
    return { kind: 'refused', reason: 'This picture could not be read.' };
  }
  const fit = fitToCap(raster.width, raster.height);
  if (fit.scaled) raster = resizeRaster(raster, fit.width, fit.height, 'bicubic');
  const type = (PHOTO_BLOB_TYPES as readonly string[]).includes(file.type)
    ? (file.type as PhotoBlobType)
    : null;
  return {
    kind: 'picture',
    picture: {
      raster,
      scaled: fit.scaled,
      ...(type && !fit.scaled ? { source: { bytes, type } } : {}),
    },
  };
}

const background = (id: string, pixels: PixelLayer['pixels']): PixelLayer => ({
  id,
  name: 'Background',
  layerKind: 'pixel',
  pixels,
});

/** A photo started from a picture: its size, one layer, Background, the picture. One edit. */
export async function startFromPicture(s: PhotoSession, pic: Picture): Promise<void> {
  const { width, height } = pic.raster;
  const id = newLayerId([]);
  if (pic.source) {
    // Kept whole: no tiles to make, the file itself stored.
    const blobId = await blobIdOf(pic.source.bytes);
    s.upload([{ id: blobId, type: pic.source.type, bytes: pic.source.bytes }], {
      id: blobId,
      raster: pic.raster,
      blob: new Blob([pic.source.bytes as Uint8Array<ArrayBuffer>], { type: pic.source.type }),
    });
    s.commitStack(
      {
        ...s.photo,
        width,
        height,
        layers: [background(id, { tiles: {}, source: { blob: blobId, width, height } })],
      },
      'Open Picture',
    );
    s.choose(id);
    return;
  }
  s.replacePixels(id, 'layer', TiledRaster.fromRaster(pic.raster));
  const photo: Photo = { ...s.photo, width, height, layers: [background(id, { tiles: {} })] };
  s.preview(photo);
  s.choose(id);
  s.commitPixels('Open Picture', [{ layerId: id, target: 'layer' }], (p) =>
    p.layers.some((l) => l.id === id) ? p : { ...p, width, height, layers: photo.layers },
  );
}

/** A photo started from a PSD: its layers, masks and groups. One edit. */
export function startFromPsd(s: PhotoSession, psd: Extract<ReadPicture, { kind: 'psd' }>): void {
  const targets: { layerId: string; target: 'layer' | 'mask' }[] = [];
  for (const [id, r] of psd.pixels.layers) {
    s.replacePixels(id, 'layer', r);
    targets.push({ layerId: id, target: 'layer' });
  }
  for (const [id, r] of psd.pixels.masks) {
    s.replacePixels(id, 'mask', r);
    targets.push({ layerId: id, target: 'mask' });
  }
  s.preview(psd.photo);
  s.choose(psd.photo.layers.at(-1)?.id ?? null);
  s.commitPixels('Open PSD', targets, () => psd.photo);
}

// 'white', 'transparent', or a colour's #rrggbb.
export type BlankFill = string;

/** A blank photo: one layer, Background, filled white, a colour, or left transparent. One edit. */
export function startBlank(s: PhotoSession, width: number, height: number, fill: BlankFill): void {
  const id = newLayerId([]);
  const layers = [background(id, { tiles: {} })];
  if (fill === 'transparent') {
    s.commitStack({ ...s.photo, width, height, layers }, 'New Photo');
    s.choose(id);
    return;
  }
  const [r, g, b] = hexToBytes(fill === 'white' ? '#ffffff' : fill);
  const pic = createRaster(width, height);
  for (let i = 0; i < pic.data.length; i += 4) pic.data.set([r, g, b, 255], i);
  s.replacePixels(id, 'layer', TiledRaster.fromRaster(pic));
  s.preview({ ...s.photo, width, height, layers });
  s.choose(id);
  s.commitPixels('New Photo', [{ layerId: id, target: 'layer' }], (p) =>
    p.layers.some((l) => l.id === id) ? p : { ...p, width, height, layers },
  );
}

/** Whether a photo has been started: an unstarted one has no layers. */
export const photoStarted = (photo: Photo): boolean => photo.layers.length > 0;
