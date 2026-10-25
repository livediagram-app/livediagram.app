// A photo's files (docs/specs/031-photo/photo-pages.md "Exports and other views"): the composite as a
// PNG, JPEG or WebP, its layers kept as a PSD, each visible layer as a PNG, and one layer alone (the
// Layers row's Export Layer). Large photos are written band by band (encodePngStream), so the whole
// picture is never one canvas.
import { photoOfPage, type LaidOutPage, type Tab } from '@livedesign/design';
import {
  compositePhoto,
  encodePngStream,
  isShown,
  psdFromPhoto,
  writePsd,
  type PhotoLayer,
  type Raster,
} from '@livedesign/photo-engine';
import { renderTabToSvg } from '../export-tab';
import type { ExportImageMap } from '../export-tab-images';
import { writeZip } from '@liveworkspace/workbench/lib/zip-writer';
import type { PixelsStore } from './pixels-store';
import { PhotoSession } from './session';
import { rasterizeText } from './text-raster';

// Rows composited and encoded at a time.
const BAND = 256;

const offsetOf = (l: PhotoLayer) =>
  l.layerKind === 'pixel' ? (l.offset ?? { x: 0, y: 0 }) : { x: 0, y: 0 };

/** A file name from a name: no path or reserved characters. */
export function fileNameOf(name: string, ext: string): string {
  const base = name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Photo';
  return `${base}.${ext}`;
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** One layer's pixels over the photo, as a PNG the photo's size. */
export function layerPng(s: PhotoSession, layerId: string): Promise<Blob> | null {
  const layer = s.layer(layerId);
  if (!layer || layer.layerKind !== 'pixel') return null;
  const o = offsetOf(layer);
  const raster = s.raster(layerId);
  return encodePngStream(
    s.photo.width,
    s.photo.height,
    (y, rows) => raster.read({ x: -o.x, y: y - o.y, width: s.photo.width, height: rows }),
    BAND,
  );
}

export async function exportLayerPng(s: PhotoSession, layerId: string): Promise<void> {
  const layer = s.layer(layerId);
  const blob = await layerPng(s, layerId);
  if (blob && layer) download(blob, fileNameOf(layer.name, 'png'));
}

export type PhotoFormat = 'png' | 'jpeg' | 'webp' | 'psd' | 'layers';

export type PhotoExportOptions = {
  format: PhotoFormat;
  // JPEG and WebP, 0 to 1; WebP's lossless when `lossless`.
  quality: number;
  lossless: boolean;
  // JPEG has no transparency: what shows through.
  matte: string;
  // The elements on the page drawn over the composite (PNG, JPEG, WebP).
  elements: HTMLImageElement | null;
};

/** A session over a photo page's photo, its pixels loaded: the one in focus, or one made for it. */
export async function loadedSession(
  tab: Tab,
  pageId: string,
  store: PixelsStore,
  inFocus: PhotoSession | null,
): Promise<{ session: PhotoSession; done: () => void }> {
  if (inFocus?.pageId === pageId) return { session: inFocus, done: () => {} };
  const noop = () => {};
  const s = new PhotoSession(photoOfPage(tab, pageId), {
    tabId: tab.id,
    pageId,
    store,
    enqueue: noop,
    commit: noop,
    checkpoint: noop,
    cancelCheckpoint: noop,
    endCheckpoint: noop,
  });
  await s.whenLoaded();
  return { session: s, done: () => s.dispose() };
}

/** The page's elements drawn at the photo's size (over the composite in an export), or null. */
export async function elementsImage(
  tab: Tab,
  page: LaidOutPage,
  images?: ExportImageMap,
): Promise<HTMLImageElement | null> {
  const on = tab.elements.filter((el) => {
    if (!('x' in el) || !('width' in el)) return false;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    return (
      cx >= page.rect.x &&
      cx < page.rect.x + page.rect.width &&
      cy >= page.rect.y &&
      cy < page.rect.y + page.rect.height
    );
  });
  if (!on.length) return null;
  const svg = renderTabToSvg(
    { ...tab, elements: on },
    { page, transparentPaper: true, ...(images ? { images } : {}) },
  );
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/** A band of the composite with the elements drawn over it. */
function bandWithElements(
  s: PhotoSession,
  y: number,
  rows: number,
  elements: HTMLImageElement | null,
): Raster {
  const band = compositePhoto(
    s.photo,
    s.lookup(),
    { x: 0, y, width: s.photo.width, height: rows },
    { text: rasterizeText },
  );
  if (!elements) return band;
  const c = document.createElement('canvas');
  c.width = band.width;
  c.height = rows;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(band.data), band.width, rows), 0, 0);
  ctx.drawImage(elements, 0, -y, s.photo.width, s.photo.height);
  return { width: band.width, height: rows, data: ctx.getImageData(0, 0, band.width, rows).data };
}

/** The photo as a file, by its format. */
export async function photoFile(
  s: PhotoSession,
  name: string,
  o: PhotoExportOptions,
): Promise<{ blob: Blob; name: string }> {
  const { width: W, height: H } = s.photo;
  if (o.format === 'png') {
    const blob = await encodePngStream(
      W,
      H,
      (y, rows) => bandWithElements(s, y, rows, o.elements),
      BAND,
    );
    return { blob, name: fileNameOf(name, 'png') };
  }
  if (o.format === 'psd') {
    const bytes = writePsd(psdFromPhoto(s.photo, s.lookup(), rasterizeText));
    return {
      blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/vnd.adobe.photoshop' }),
      name: fileNameOf(name, 'psd'),
    };
  }
  if (o.format === 'layers') {
    const files: { name: string; data: Uint8Array }[] = [];
    const taken = new Set<string>();
    for (const l of [...s.photo.layers].reverse()) {
      if (!isShown(s.photo.layers, l.id) || l.layerKind === 'group' || l.layerKind === 'adjustment')
        continue;
      // Each layer alone, as it draws (its opacity, mask and effects), the photo's size.
      const alone = {
        ...s.photo,
        layers: [{ ...l, parent: undefined, clip: undefined } as PhotoLayer],
      };
      const blob = await encodePngStream(
        W,
        H,
        (y, rows) =>
          compositePhoto(
            alone,
            s.lookup(),
            { x: 0, y, width: W, height: rows },
            { text: rasterizeText },
          ),
        BAND,
      );
      let file = fileNameOf(l.name, 'png');
      for (let n = 2; taken.has(file); n++) file = fileNameOf(`${l.name} ${n}`, 'png');
      taken.add(file);
      files.push({ name: file, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    return {
      blob: new Blob([writeZip(files)], { type: 'application/zip' }),
      name: fileNameOf(name, 'zip'),
    };
  }
  // JPEG and WebP: one canvas, the matte under a JPEG.
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  if (o.format === 'jpeg') {
    ctx.fillStyle = o.matte;
    ctx.fillRect(0, 0, W, H);
  }
  for (let y = 0; y < H; y += BAND) {
    const rows = Math.min(BAND, H - y);
    const band = compositePhoto(
      s.photo,
      s.lookup(),
      { x: 0, y, width: W, height: rows },
      { text: rasterizeText },
    );
    const tmp = document.createElement('canvas');
    tmp.width = W;
    tmp.height = rows;
    tmp
      .getContext('2d')!
      .putImageData(new ImageData(new Uint8ClampedArray(band.data), W, rows), 0, 0);
    ctx.drawImage(tmp, 0, y);
  }
  if (o.elements) ctx.drawImage(o.elements, 0, 0, W, H);
  const type = o.format === 'jpeg' ? 'image/jpeg' : 'image/webp';
  const blob = await new Promise<Blob | null>((resolve) =>
    c.toBlob(resolve, type, o.format === 'webp' && o.lossless ? 1 : o.quality),
  );
  if (!blob) throw new Error('This browser could not write the file.');
  return { blob, name: fileNameOf(name, o.format === 'jpeg' ? 'jpg' : 'webp') };
}
