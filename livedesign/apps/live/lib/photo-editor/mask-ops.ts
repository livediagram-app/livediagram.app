// Layer masks and selections from layers (docs/specs/031-photo/photo-layers.md "Layer operations"
// Masks, Select Pixels): Add (reveal all, hide all, from the selection, from the layer's
// transparency), Apply, Delete, Disable/Enable, Invert, Select Mask and Select Pixels. A mask's
// white is its empty, so a mask that hides anything is written over the photo and the layer's extent.
import {
  createMask,
  setLayer,
  TiledRaster,
  type Mask8,
  type PhotoLayer,
  type Rect,
} from '@livedesign/photo-engine';
import { extentOf } from './layer-ops';
import type { PhotoSession } from './session';
import { greyOver, selectionAt } from './selection-mask';

export type AddMaskHow = 'reveal' | 'hide' | 'selection' | 'transparency';

const offsetOf = (l: PhotoLayer) =>
  l.layerKind === 'pixel' ? (l.offset ?? { x: 0, y: 0 }) : { x: 0, y: 0 };

function cover(s: PhotoSession, layer: PhotoLayer): Rect {
  const photo = { x: 0, y: 0, width: s.photo.width, height: s.photo.height };
  const e = extentOf(s, layer);
  if (!e) return photo;
  const x = Math.min(0, e.x);
  const y = Math.min(0, e.y);
  return {
    x,
    y,
    width: Math.max(photo.width, e.x + e.width) - x,
    height: Math.max(photo.height, e.y + e.height) - y,
  };
}

/** A mask's grey over `rect` (photo px) from `value(x, y)`. */
export function addMask(s: PhotoSession, id: string, how: AddMaskHow): string | null {
  const layer = s.layer(id);
  if (!layer) return 'Choose a layer to mask.';
  if (layer.mask) return `${layer.name} already has a mask.`;
  if (how === 'selection' && !s.selection) return 'Make a selection first.';
  const mask = new TiledRaster(1, 255);
  const o = offsetOf(layer);
  if (how !== 'reveal') {
    const rect = cover(s, layer);
    let grey: Uint8Array;
    if (how === 'hide') grey = new Uint8Array(rect.width * rect.height);
    else if (how === 'selection') grey = greyOver(rect, (x, y) => selectionAt(s.selection, x, y));
    else {
      if (layer.layerKind !== 'pixel') return 'Only a pixel layer has transparency to mask by.';
      grey = s
        .raster(id)
        .readChannel(
          { x: rect.x - o.x, y: rect.y - o.y, width: rect.width, height: rect.height },
          3,
        );
    }
    mask.writeChannel(
      { x: rect.x - o.x, y: rect.y - o.y, width: rect.width, height: rect.height },
      grey,
    );
  }
  s.replacePixels(id, 'mask', mask);
  s.target = 'mask';
  s.commitPixels('Add Mask', [{ layerId: id, target: 'mask' }], (p) =>
    p.layers.find((l) => l.id === id)?.mask
      ? p
      : setLayer(p, id, { mask: { pixels: { tiles: {} } } }),
  );
  return null;
}

/** Apply Mask: a pixel layer's alpha times its mask, the mask gone. */
export function applyMask(s: PhotoSession, id: string): string | null {
  const layer = s.layer(id);
  if (!layer?.mask) return 'This layer has no mask.';
  if (layer.layerKind !== 'pixel') return 'Rasterize the layer to apply its mask.';
  const raster = s.raster(id);
  const b = raster.contentBounds();
  if (b) {
    const mo =
      layer.mask.linked === false ? (layer.mask.offset ?? { x: 0, y: 0 }) : offsetOf(layer);
    const o = offsetOf(layer);
    const pic = raster.read(b);
    const grey = s
      .raster(id, 'mask')
      .readChannel({ x: b.x + o.x - mo.x, y: b.y + o.y - mo.y, width: b.width, height: b.height });
    for (let i = 0; i < grey.length; i++)
      pic.data[i * 4 + 3] = (pic.data[i * 4 + 3]! * grey[i]!) / 255;
    raster.write(pic, b.x, b.y);
  }
  s.target = 'layer';
  s.commitPixels('Apply Mask', [{ layerId: id, target: 'layer' }], (p) =>
    setLayer(p, id, { mask: undefined }),
  );
  return null;
}

export function deleteMask(s: PhotoSession, id: string): void {
  if (!s.layer(id)?.mask) return;
  s.target = 'layer';
  s.commitStack(setLayer(s.photo, id, { mask: undefined }), 'Delete Mask');
}

export function toggleMask(s: PhotoSession, id: string): void {
  const mask = s.layer(id)?.mask;
  if (!mask) return;
  const on = mask.enabled === false;
  const { enabled: _e, ...rest } = mask;
  void _e;
  s.commitStack(
    setLayer(s.photo, id, { mask: on ? rest : { ...rest, enabled: false } }),
    on ? 'Enable Mask' : 'Disable Mask',
  );
}

export function invertMask(s: PhotoSession, id: string): void {
  const layer = s.layer(id);
  if (!layer?.mask) return;
  const rect = cover(s, layer);
  const mo = layer.mask.linked === false ? (layer.mask.offset ?? { x: 0, y: 0 }) : offsetOf(layer);
  const local = { x: rect.x - mo.x, y: rect.y - mo.y, width: rect.width, height: rect.height };
  const raster = s.raster(id, 'mask');
  const grey = raster.readChannel(local);
  for (let i = 0; i < grey.length; i++) grey[i] = 255 - grey[i]!;
  raster.writeChannel(local, grey);
  s.changed();
  s.commitPixels('Invert Mask', [{ layerId: id, target: 'mask' }]);
}

/** Select Mask: the mask's grey as the selection, over the photo. */
export function selectMask(s: PhotoSession, id: string): void {
  const layer = s.layer(id);
  if (!layer?.mask) return;
  const mo = layer.mask.linked === false ? (layer.mask.offset ?? { x: 0, y: 0 }) : offsetOf(layer);
  const rect = { x: 0, y: 0, width: s.photo.width, height: s.photo.height };
  const m = createMask(rect);
  m.data.set(
    s
      .raster(id, 'mask')
      .readChannel({ x: -mo.x, y: -mo.y, width: rect.width, height: rect.height }),
  );
  setSelection(s, m);
}

/** Select Pixels: a layer's alpha as the selection. */
export function selectPixels(s: PhotoSession, id: string): string | null {
  const layer = s.layer(id);
  if (!layer || layer.layerKind !== 'pixel') return 'Only a pixel layer has pixels to select.';
  const b = extentOf(s, layer);
  if (!b) return 'The layer is empty.';
  const o = offsetOf(layer);
  const m = createMask(b);
  m.data.set(
    s.raster(id).readChannel({ x: b.x - o.x, y: b.y - o.y, width: b.width, height: b.height }, 3),
  );
  setSelection(s, m);
  return null;
}

export function setSelection(s: PhotoSession, m: Mask8 | null): void {
  if (s.selection) s.lastSelection = s.selection;
  s.selection = m;
  s.changed();
}
