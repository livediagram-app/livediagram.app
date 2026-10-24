// The photo clipboard (docs/specs/031-photo/photo-tools.md "The clipboard"): Copy takes the
// selection's pixels of the active layer (Copy Merged: of the composite), Cut also clears them, and
// both put a PNG on the system clipboard so it pastes into other apps. Paste lands photo pixels (or a
// picture from the system clipboard) as a new layer, centred, or in place where they were copied.
import {
  compositePhoto,
  maskBounds,
  type PhotoLayer,
  type Raster,
  type Rect,
} from '@livedesign/photo-engine';
import { clearSelection } from './edit-ops';
import { extentOf, placePicture } from './layer-ops';
import { photoWorkers } from './photo-worker-client';
import type { PhotoSession } from './session';
import { rasterizeText } from './text-raster';
import { debugLog } from '../debug-log';

export type PhotoClip = { raster: Raster; x: number; y: number; pngBytes: number };

// This browser's last photo copy: its pixels and place, and the size of the PNG it put on the system
// clipboard (a paste of that same PNG is this copy, so it keeps its place).
let clip: PhotoClip | null = null;

const offsetOf = (l: PhotoLayer) =>
  l.layerKind === 'pixel' ? (l.offset ?? { x: 0, y: 0 }) : { x: 0, y: 0 };

/** The pixels a copy takes, and where they sat; null when there is nothing. */
function copied(s: PhotoSession, merged: boolean): { raster: Raster; rect: Rect } | string {
  const sel = s.selection;
  const layer = s.layer(s.active);
  let rect: Rect | null = sel ? maskBounds(sel) : null;
  let raster: Raster;
  if (merged) {
    rect ??= { x: 0, y: 0, width: s.photo.width, height: s.photo.height };
    raster = compositePhoto(s.photo, s.lookup(), rect, { text: rasterizeText });
  } else {
    if (!layer || layer.layerKind !== 'pixel')
      return 'Choose a pixel layer to copy, or use Copy Merged.';
    rect ??= extentOf(s, layer);
    if (!rect) return 'Nothing to copy: the layer is empty.';
    const o = offsetOf(layer);
    raster = s
      .raster(layer.id)
      .read({ x: rect.x - o.x, y: rect.y - o.y, width: rect.width, height: rect.height });
  }
  if (sel)
    for (let y = 0; y < rect.height; y++)
      for (let x = 0; x < rect.width; x++) {
        const mx = rect.x + x - sel.x;
        const my = rect.y + y - sel.y;
        const m =
          mx < 0 || my < 0 || mx >= sel.width || my >= sel.height
            ? 0
            : sel.data[my * sel.width + mx]!;
        const i = (y * rect.width + x) * 4 + 3;
        raster.data[i] = (raster.data[i]! * m) / 255;
      }
  return { raster, rect };
}

/** The PNG put on the system clipboard. The write starts at once, inside the press's gesture (Safari
 *  allows it only there), with the PNG still being encoded. Answers the PNG's size. */
async function toSystemClipboard(raster: Raster): Promise<number> {
  const png = photoWorkers()
    .run({
      kind: 'encode',
      width: raster.width,
      height: raster.height,
      data: new Uint8ClampedArray(raster.data),
      type: 'image/png',
    })
    .result.then((res) => {
      if (res.kind !== 'encode') throw new Error('encode failed');
      return res.bytes;
    });
  const blob = png.then(
    (bytes) => new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }),
  );
  try {
    await navigator.clipboard?.write?.([new ClipboardItem({ 'image/png': blob })]);
  } catch (err) {
    // A browser that refuses the write still has the photo's own copy.
    debugLog('[photo] clipboard write refused', { error: String(err) });
  }
  return (await png.catch(() => new Uint8Array())).length;
}

export async function copy(s: PhotoSession, merged = false): Promise<string | null> {
  const got = copied(s, merged);
  if (typeof got === 'string') return got;
  clip = { raster: got.raster, x: got.rect.x, y: got.rect.y, pngBytes: 0 };
  const mine = clip;
  mine.pngBytes = await toSystemClipboard(got.raster);
  return null;
}

export async function cut(s: PhotoSession, background: string): Promise<string | null> {
  const refused = await copy(s, false);
  if (refused) return refused;
  if (s.selection) return clearSelection(s, background);
  // No selection: the whole layer's pixels go.
  const layer = s.layer(s.active);
  if (layer?.layerKind === 'pixel') {
    const raster = s.raster(layer.id);
    for (const k of raster.keys()) raster.clearTile(k);
    s.changed();
    s.commitPixels('Cut', [{ layerId: layer.id, target: 'layer' }]);
  }
  return null;
}

/** Paste: the photo's own copy (in place when asked), or a picture from the system clipboard (`pic`,
 *  with its PNG's size when known). Answers the new layer's id. */
export function paste(
  s: PhotoSession,
  inPlace: boolean,
  pic?: { raster: Raster; bytes?: number },
): string | null {
  const own = clip && (!pic || (pic.bytes && pic.bytes === clip.pngBytes)) ? clip : null;
  if (own)
    return placePicture(s, own.raster, 'Layer', inPlace ? { x: own.x, y: own.y } : undefined);
  if (pic) return placePicture(s, pic.raster, 'Pasted Picture');
  return null;
}
