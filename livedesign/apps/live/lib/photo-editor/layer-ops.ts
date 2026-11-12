// The layer operations (docs/specs/031-photo/photo-layers.md "Layer operations"): each one edit,
// named in History by its name. Those that make pixels (merges, rasterizing, a placed picture, a
// layer via copy) composite on this thread and commit the new tiles with the stack change.
import {
  addLayer,
  ADJUSTMENTS,
  compositePhoto,
  duplicateLayers,
  effectsMargin,
  groupLayers,
  hasEffects,
  moveLayer,
  newLayerId,
  nextLayerName,
  removeLayers,
  resizeRaster,
  setLayer,
  siblingsOf,
  stepLayer,
  TiledRaster,
  ungroup,
  type AdjustmentId,
  type FillLayer,
  type Photo,
  type PhotoLayer,
  type PixelLayer,
  type Raster,
} from '@livedesign/photo-engine';
import { shakeLock } from './lock-shake';
import type { PhotoSession } from './session';
import { rasterizeText } from './text-raster';
import { selectionMaskRaster } from './selection-mask';
import {
  idsOf,
  offsetOf,
  photoRect,
  extentOf,
  plain,
  pixelLayerOf,
  once,
  commitNewLayer,
  plainKeepSettings,
} from './layer-pixels';
export {
  STILL_MERGING,
  mergeDown,
  mergeVisible,
  mergeLayers,
  flattenDiscards,
  flatten,
} from './layer-merges';
export { extentOf, layerBelow } from './layer-pixels';

export function newLayer(s: PhotoSession): void {
  const layer: PixelLayer = {
    id: newLayerId(idsOf(s.photo)),
    name: nextLayerName('Layer', s.photo.layers),
    layerKind: 'pixel',
    pixels: { tiles: {} },
  };
  s.commitStack(addLayer(s.photo, layer, s.active ?? undefined), 'New Layer');
  s.active = layer.id;
}

export function newGroup(s: PhotoSession, ids: readonly string[]): void {
  const chosen = ids.length ? ids : s.active ? [s.active] : [];
  const made = chosen.length
    ? groupLayers(s.photo, chosen, nextLayerName('Group', s.photo.layers))
    : undefined;
  if (made) {
    s.commitStack(made.photo, 'Group');
    s.active = made.group;
    return;
  }
  const group: PhotoLayer = {
    id: newLayerId(idsOf(s.photo)),
    name: nextLayerName('Group', s.photo.layers),
    layerKind: 'group',
  };
  s.commitStack(addLayer(s.photo, group, s.active ?? undefined), 'New Group');
  s.active = group.id;
}

export function ungroupLayer(s: PhotoSession, id: string): void {
  if (s.layer(id)?.layerKind !== 'group') return;
  s.commitStack(ungroup(s.photo, id), 'Ungroup');
}

export function duplicate(s: PhotoSession, ids: readonly string[]): void {
  if (!ids.length) return;
  const { photo, copies } = duplicateLayers(s.photo, ids);
  s.commitStack(photo, 'Duplicate Layer');
  s.active = copies.at(-1) ?? s.active;
}

export function deleteLayers(s: PhotoSession, ids: readonly string[]): void {
  if (!ids.length) return;
  s.commitStack(removeLayers(s.photo, ids), ids.length > 1 ? 'Delete Layers' : 'Delete Layer');
}

export type ArrangeHow = 'forward' | 'backward' | 'front' | 'back';
const ARRANGE_LABEL: Record<ArrangeHow, string> = {
  forward: 'Bring Forward',
  backward: 'Send Backward',
  front: 'Bring to Front',
  back: 'Send to Back',
};

/** The active layer moved among its siblings: one place up or down, or to the top or bottom of its
 *  group (or of the stack). */
export function arrangeLayer(s: PhotoSession, how: ArrangeHow): void {
  const layer = s.layer(s.active);
  if (!layer) return;
  let next: Photo;
  if (how === 'forward' || how === 'backward')
    next = stepLayer(s.photo, layer.id, how === 'forward' ? 1 : -1);
  else {
    const siblings = siblingsOf(s.photo.layers, layer.parent);
    const end = how === 'front' ? siblings.at(-1) : siblings[0];
    next =
      end && end.id !== layer.id
        ? moveLayer(s.photo, layer.id, how === 'front' ? { above: end.id } : { below: end.id })
        : s.photo;
  }
  if (next !== s.photo) s.commitStack(next, ARRANGE_LABEL[how]);
}

/** The layer above (`1`) or below (`-1`) the active one made active, the others let go. */
export function stepActive(s: PhotoSession, by: 1 | -1): void {
  const layers = s.photo.layers;
  const i = layers.findIndex((l) => l.id === s.active);
  const next = layers[i < 0 ? layers.length - 1 : i + by];
  if (!next) return;
  s.chosen = new Set();
  s.choose(next.id, 'layer');
}

/** Rasterize: a text or fill layer into its pixels, keeping its settings, mask and effects. */
export function rasterize(s: PhotoSession, id: string): string | null {
  const layer = s.layer(id);
  if (!layer || (layer.layerKind !== 'text' && layer.layerKind !== 'fill'))
    return 'Only a text or fill layer can be rasterized.';
  const rect = extentOf(s, layer)!;
  const { effects: _e, ...bare } = plain(layer) as PhotoLayer & { effects?: unknown };
  void _e;
  const pic = compositePhoto({ ...s.photo, layers: [bare] }, s.lookup(), rect, {
    text: rasterizeText,
  });
  s.replacePixels(id, 'layer', TiledRaster.fromRaster(pic, rect.x, rect.y));
  s.commitPixels('Rasterize', [{ layerId: id, target: 'layer' }], (p) => ({
    ...p,
    layers: p.layers.map((l) =>
      l.id === id && l.layerKind !== 'pixel'
        ? { ...plainKeepSettings(l), layerKind: 'pixel' as const, pixels: { tiles: {} } }
        : l,
    ),
  }));
  return null;
}

/** Rasterize Effects: a pixel layer's effects drawn into its pixels, the effects gone. One edit. */
export function rasterizeEffects(s: PhotoSession, id: string): string | null {
  const layer = s.layer(id);
  if (!layer || layer.layerKind !== 'pixel' || !hasEffects(layer.effects))
    return 'This layer has no effects to rasterize.';
  const b = extentOf(s, layer);
  if (!b) return 'This layer has no pixels for its effects.';
  const m = effectsMargin(layer.effects);
  const rect = { x: b.x - m, y: b.y - m, width: b.width + m * 2, height: b.height + m * 2 };
  const pic = compositePhoto({ ...s.photo, layers: [plain(layer)] }, s.lookup(), rect, {
    text: rasterizeText,
  });
  const o = offsetOf(layer);
  s.replacePixels(id, 'layer', TiledRaster.fromRaster(pic, rect.x - o.x, rect.y - o.y));
  s.commitPixels('Rasterize Effects', [{ layerId: id, target: 'layer', dropSource: true }], (p) =>
    setLayer(p, id, { effects: undefined }),
  );
  return null;
}

/** Layer Via Copy / Cut: the selection's pixels of the active layer into a new layer above (Cut
 *  leaves them transparent). */
export function layerVia(s: PhotoSession, cut: boolean): string | null {
  const layer = s.layer(s.active);
  if (!layer || layer.layerKind !== 'pixel') return 'Choose a pixel layer to copy from.';
  if (cut) {
    // Cut changes the layer's pixels (whatever the target): refused on a locked or hidden layer, as
    // Delete is.
    if (layer.visible === false) return `${layer.name} is hidden. Show it to change it.`;
    if (layer.locks?.pixels || layer.locks?.all) {
      shakeLock(layer.id);
      return `${layer.name} is locked.`;
    }
  }
  const rect = s.selection
    ? { x: s.selection.x, y: s.selection.y, width: s.selection.width, height: s.selection.height }
    : extentOf(s, layer);
  if (!rect) return 'Nothing to copy: the layer is empty.';
  const o = offsetOf(layer);
  const raster = s.raster(layer.id);
  const local = { x: rect.x - o.x, y: rect.y - o.y, width: rect.width, height: rect.height };
  const pic = raster.read(local);
  const left = cut ? raster.read(local) : null;
  const sel = s.selection;
  if (sel)
    for (let i = 0; i < sel.data.length; i++) {
      const m = sel.data[i]!;
      pic.data[i * 4 + 3] = (pic.data[i * 4 + 3]! * m) / 255;
      if (left) left.data[i * 4 + 3] = (left.data[i * 4 + 3]! * (255 - m)) / 255;
    }
  else if (left) left.data.fill(0);
  if (left) raster.write(left, local.x, local.y);
  const id = newLayerId(idsOf(s.photo));
  const made = pixelLayerOf(
    s,
    { id, name: nextLayerName('Layer', s.photo.layers) },
    pic,
    rect.x,
    rect.y,
  );
  commitNewLayer(
    s,
    cut ? 'Layer Via Cut' : 'Layer Via Copy',
    made,
    layer.id,
    cut ? [{ layerId: layer.id, target: 'layer' }] : [],
  );
  return null;
}

/** A picture dropped, pasted or placed: a new pixel layer above the active one, centred (or where it
 *  was copied, `at`), scaled down to fit the photo when larger. Answers the new layer's id. */
export function placePicture(
  s: PhotoSession,
  pic: Raster,
  name: string,
  at?: { x: number; y: number },
  label = 'Place Picture',
): string {
  const { width: W, height: H } = s.photo;
  let fitted = pic;
  if (!at && (pic.width > W || pic.height > H)) {
    const k = Math.min(W / pic.width, H / pic.height);
    fitted = resizeRaster(
      pic,
      Math.max(1, Math.round(pic.width * k)),
      Math.max(1, Math.round(pic.height * k)),
      'bicubic',
    );
  }
  const x = at?.x ?? Math.round((W - fitted.width) / 2);
  const y = at?.y ?? Math.round((H - fitted.height) / 2);
  const id = newLayerId(idsOf(s.photo));
  const layer = pixelLayerOf(s, { id, name: nextLayerName(name, s.photo.layers) }, fitted, x, y);
  commitNewLayer(s, label, layer, s.active ?? undefined);
  return id;
}

/** A new adjustment layer above the active one (clipped to it with `clip`). */
export function newAdjustmentLayer(s: PhotoSession, id: AdjustmentId, clip = false): string {
  const def = ADJUSTMENTS[id];
  const layer: PhotoLayer = {
    id: newLayerId(idsOf(s.photo)),
    name: nextLayerName(def.name, s.photo.layers),
    layerKind: 'adjustment',
    adjustment: { id, params: structuredClone(def.defaults) },
    ...(clip ? { clip: true as const } : {}),
  };
  // Masked by the selection when there is one (photo-adjustments.md "The Adjust tab"): the layer and its
  // mask one edit.
  if (s.selection) {
    s.replacePixels(layer.id, 'mask', selectionMaskRaster(s.selection, photoRect(s.photo)));
    const add = once(layer.id, (p) =>
      addLayer(p, { ...layer, mask: { pixels: { tiles: {} } } }, s.active ?? undefined),
    );
    s.preview(add(s.photo));
    s.active = layer.id;
    s.commitPixels(def.name, [{ layerId: layer.id, target: 'mask' }], add);
    return layer.id;
  }
  s.commitStack(addLayer(s.photo, layer, s.active ?? undefined), def.name);
  s.active = layer.id;
  return layer.id;
}

/** A new fill layer above the active one. */
export function newFillLayer(s: PhotoSession, fill: FillLayer['fill']): string {
  const stem = fill.kind === 'solid' ? 'Colour Fill' : 'Gradient Fill';
  const layer: FillLayer = {
    id: newLayerId(idsOf(s.photo)),
    name: nextLayerName(stem, s.photo.layers),
    layerKind: 'fill',
    fill,
  };
  s.commitStack(addLayer(s.photo, layer, s.active ?? undefined), stem);
  s.active = layer.id;
  return layer.id;
}

/** Create / Release Clipping Mask. */
export function toggleClip(s: PhotoSession, id: string): void {
  const layer = s.layer(id);
  if (!layer) return;
  s.commitStack(
    setLayer(s.photo, id, { clip: layer.clip ? undefined : true }),
    layer.clip ? 'Release Clipping Mask' : 'Create Clipping Mask',
  );
}
