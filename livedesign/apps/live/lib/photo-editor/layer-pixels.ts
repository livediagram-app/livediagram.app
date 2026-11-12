// What the layer operations share (layer-ops.ts, layer-merges.ts): a layer's extent and offset, a pixel layer
// made from a composite, the one edit that adds a new layer, and the sibling under a layer.

import {
  addLayer,
  descendantIds,
  siblingsOf,
  TiledRaster,
  type Photo,
  type PhotoLayer,
  type PixelLayer,
  type Raster,
  type Rect,
} from '@livedesign/photo-engine';
import type { PhotoSession } from './session';
import { textBox } from './text-raster';

export const idsOf = (p: Photo) => p.layers.map((l) => l.id);
export const offsetOf = (l: PhotoLayer) =>
  l.layerKind === 'pixel' ? (l.offset ?? { x: 0, y: 0 }) : { x: 0, y: 0 };
export const photoRect = (p: Photo): Rect => ({ x: 0, y: 0, width: p.width, height: p.height });

export function union(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/** Where a layer's content lies in the photo: a pixel layer's tiles, a text layer's box, the photo for
 *  the rest (a group: what its layers cover). */
export function extentOf(s: PhotoSession, layer: PhotoLayer): Rect | null {
  if (layer.layerKind === 'pixel') {
    const b = s.raster(layer.id).contentBounds();
    const o = offsetOf(layer);
    return b ? { x: b.x + o.x, y: b.y + o.y, width: b.width, height: b.height } : null;
  }
  if (layer.layerKind === 'text') return textBox(layer);
  if (layer.layerKind === 'group')
    return descendantIds(s.photo.layers, layer.id).reduce<Rect | null>((acc, id) => {
      const l = s.layer(id);
      return l && l.layerKind !== 'adjustment' ? union(acc, extentOf(s, l)) : acc;
    }, null);
  return photoRect(s.photo);
}

/** A layer as it is drawn alone: no blend, opacity, mask, clip or group, but its effects kept. */
export const plain = (l: PhotoLayer): PhotoLayer => {
  const { opacity: _o, blend: _b, mask: _m, clip: _c, parent: _p, visible: _v, ...rest } = l;
  void [_o, _b, _m, _c, _p, _v];
  return rest;
};

/** A pixel layer with these pixels (photo coordinates at `x`, `y`), the session holding them. */
export function pixelLayerOf(
  s: PhotoSession,
  base: Partial<PixelLayer> & { id: string; name: string },
  pic: Raster,
  x: number,
  y: number,
): PixelLayer {
  s.replacePixels(base.id, 'layer', TiledRaster.fromRaster(pic));
  return {
    ...base,
    layerKind: 'pixel',
    pixels: { tiles: {} },
    ...(x || y ? { offset: { x, y } } : {}),
  };
}

/** The stack change added once: a commit applies it to the latest photo, maybe after a preview did. */
export const once = (id: string, edit: (p: Photo) => Photo) => (p: Photo) =>
  p.layers.some((l) => l.id === id) ? p : edit(p);

/** A new layer with pixels committed as one edit, previewed at once. */
export function commitNewLayer(
  s: PhotoSession,
  label: string,
  layer: PixelLayer,
  above: string | undefined,
  also: { layerId: string; target: 'layer' | 'mask' }[] = [],
): void {
  const add = once(layer.id, (p) => addLayer(p, layer, above));
  s.preview(add(s.photo));
  s.active = layer.id;
  s.target = 'layer';
  s.commitPixels(label, [{ layerId: layer.id, target: 'layer' }, ...also], add);
}

/** The sibling directly under a layer. */
export function layerBelow(photo: Photo, id: string): PhotoLayer | undefined {
  const layer = photo.layers.find((l) => l.id === id);
  if (!layer) return undefined;
  const siblings = siblingsOf(photo.layers, layer.parent);
  return siblings[siblings.findIndex((l) => l.id === id) - 1];
}

/** A layer's settings without what only a text or fill layer has. */
export function plainKeepSettings(l: PhotoLayer): Omit<PhotoLayer, 'layerKind'> {
  const { text: _t, fill: _f, ...rest } = l as PhotoLayer & { text?: unknown; fill?: unknown };
  void [_t, _f];
  return rest;
}
