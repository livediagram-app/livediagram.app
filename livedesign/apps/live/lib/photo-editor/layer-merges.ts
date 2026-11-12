// The merges (layer-ops.ts, docs/specs/031-photo/photo-layers.md "Layer operations"): Merge Down, Merge Visible,
// Merge Layers and Flatten Image, each compositing on this thread and refused while another merge on the same
// session is still landing. layer-ops.ts re-exports them.

import {
  descendantIds,
  isShown,
  newLayerId,
  removeLayers,
  TiledRaster,
  type Photo,
  type PhotoLayer,
  type PixelLayer,
} from '@livedesign/photo-engine';
import type { PhotoSession } from './session';
import { rasterizeText } from './text-raster';
import { compositeSliced } from './sliced-composite';
import {
  idsOf,
  offsetOf,
  photoRect,
  union,
  extentOf,
  plain,
  pixelLayerOf,
  once,
  layerBelow,
  plainKeepSettings,
} from './layer-pixels';

// The sessions with a merge compositing now: a second asked meanwhile would merge what the first is
// about to remove, so it is refused until the first has landed.
const merging = new WeakSet<PhotoSession>();
export const STILL_MERGING = 'Still merging: try again in a moment.';

/** `run` while no other merge works on this session. */
async function oneMerge<T>(s: PhotoSession, run: () => Promise<T>): Promise<T | string> {
  if (merging.has(s)) return STILL_MERGING;
  merging.add(s);
  try {
    return await run();
  } finally {
    merging.delete(s);
  }
}

/** Merge Down: the active layer drawn into the one under it, by its blend mode, mask, opacity and
 *  effects, the lower one keeping its name and settings. */
export function mergeDown(s: PhotoSession): Promise<string | null> {
  return oneMerge(s, () => mergeDownNow(s));
}

async function mergeDownNow(s: PhotoSession): Promise<string | null> {
  const upper = s.layer(s.active);
  if (!upper) return 'Choose a layer to merge down.';
  const lower = layerBelow(s.photo, upper.id);
  if (!lower || lower.layerKind === 'group' || lower.layerKind === 'adjustment')
    return 'Merge Down needs a pixel layer under this one.';
  if (lower.visible === false) return `${lower.name} is hidden. Show it to merge into it.`;
  const upperIds =
    upper.layerKind === 'group'
      ? [upper.id, ...descendantIds(s.photo.layers, upper.id)]
      : [upper.id];
  const rect =
    upper.layerKind === 'adjustment'
      ? extentOf(s, lower)
      : union(extentOf(s, lower), extentOf(s, upper));
  if (!rect) {
    s.commitStack(removeLayers(s.photo, [upper.id]), 'Merge Down');
    return null;
  }
  // The pair alone: the lower drawn plain (its own settings stay on it), the upper as it is.
  const { parent: _p, ...top } = upper;
  void _p;
  const pair = [
    plain(lower),
    ...s.photo.layers.filter((l) => upperIds.includes(l.id) && l.id !== upper.id),
    top as PhotoLayer,
  ];
  const merged = await compositeSliced({ ...s.photo, layers: pair }, s.lookup(), rect, {
    text: rasterizeText,
  });
  const o = offsetOf(lower);
  const raster = lower.layerKind === 'pixel' ? s.raster(lower.id) : new TiledRaster();
  raster.write(merged, rect.x - o.x, rect.y - o.y);
  // A text or fill layer under it is a pixel layer now.
  const asPixel = (p: Photo): Photo =>
    lower.layerKind === 'pixel'
      ? p
      : {
          ...p,
          layers: p.layers.map((l) =>
            l.id === lower.id
              ? {
                  ...plainKeepSettings(l),
                  layerKind: 'pixel' as const,
                  pixels: { tiles: {} },
                }
              : l,
          ),
        };
  if (lower.layerKind !== 'pixel') s.replacePixels(lower.id, 'layer', raster);
  s.active = lower.id;
  s.commitPixels('Merge Down', [{ layerId: lower.id, target: 'layer' }], (p) =>
    removeLayers(asPixel(p), [upper.id]),
  );
  return null;
}

/** Merge Visible: every shown layer into one pixel layer at the bottom-most shown one's place. */
export function mergeVisible(s: PhotoSession): Promise<string | null> {
  return oneMerge(s, () => mergeVisibleNow(s));
}

async function mergeVisibleNow(s: PhotoSession): Promise<string | null> {
  const shown = s.photo.layers.filter((l) => isShown(s.photo.layers, l.id));
  if (shown.length < 2) return 'Nothing to merge: fewer than two layers show.';
  const bottom = shown[0]!;
  const pic = await compositeSliced(s.photo, s.lookup(), photoRect(s.photo), {
    text: rasterizeText,
  });
  const id = newLayerId(idsOf(s.photo));
  const layer = pixelLayerOf(s, { id, name: bottom.name }, pic, 0, 0);
  const gone = new Set(shown.map((l) => l.id));
  const edit = once(id, (p) => {
    const at = p.layers.findIndex((l) => gone.has(l.id));
    // A hidden layer stays (photo-layers.md "Merge Visible"), a hidden one inside a merged group too:
    // it leaves the group, which is gone. Every layer before `at` is kept, so `at` is its place.
    const kept = p.layers
      .filter((l) => !gone.has(l.id))
      .map((l) => {
        if (!l.parent || !gone.has(l.parent)) return l;
        const { parent: _gone, ...rest } = l;
        void _gone;
        return rest;
      });
    const index = Math.max(0, Math.min(at, kept.length));
    return { ...p, layers: [...kept.slice(0, index), layer, ...kept.slice(index)] };
  });
  s.preview(edit(s.photo));
  s.active = id;
  s.commitPixels('Merge Visible', [{ layerId: id, target: 'layer' }], edit);
  return null;
}

/** Merge Layers (Merge Down with several chosen): the chosen layers, with what their groups hold, drawn
 *  together as one pixel layer at the top-most one's place and named after it. One edit. */
export function mergeLayers(s: PhotoSession, ids: readonly string[]): Promise<string | null> {
  return oneMerge(s, () => mergeLayersNow(s, ids));
}

async function mergeLayersNow(s: PhotoSession, ids: readonly string[]): Promise<string | null> {
  const layers = s.photo.layers;
  const gone = new Set(
    ids.flatMap((id) =>
      layers.some((l) => l.id === id && l.layerKind === 'group')
        ? [id, ...descendantIds(layers, id)]
        : [id],
    ),
  );
  const picked = layers.filter((l) => gone.has(l.id));
  if (picked.length < 2) return 'Choose two or more layers to merge.';
  const top = picked.at(-1)!;
  // The chosen alone, out of any group not merged with them.
  const own = picked.map((l) => {
    if (!l.parent || gone.has(l.parent)) return l;
    const { parent: _p, ...rest } = l;
    void _p;
    return rest;
  });
  const pic = await compositeSliced({ ...s.photo, layers: own }, s.lookup(), photoRect(s.photo), {
    text: rasterizeText,
  });
  const id = newLayerId(idsOf(s.photo));
  const made = pixelLayerOf(s, { id, name: top.name }, pic, 0, 0);
  const layer: PixelLayer =
    top.parent && !gone.has(top.parent) ? { ...made, parent: top.parent } : made;
  const edit = once(id, (p) => {
    const at = p.layers.findIndex((l) => l.id === top.id);
    const kept = p.layers.filter((l) => !gone.has(l.id));
    const index =
      at < 0 ? kept.length : p.layers.slice(0, at + 1).filter((l) => !gone.has(l.id)).length;
    return { ...p, layers: [...kept.slice(0, index), layer, ...kept.slice(index)] };
  });
  s.preview(edit(s.photo));
  s.active = id;
  s.chosen = new Set();
  s.commitPixels('Merge Layers', [{ layerId: id, target: 'layer' }], edit);
  return null;
}

/** Whether Flatten Image would discard hidden layers (it asks first). */
export const flattenDiscards = (photo: Photo): boolean =>
  photo.layers.some((l) => !isShown(photo.layers, l.id));

/** Flatten Image: the composite as the one layer, Background. */
export async function flatten(s: PhotoSession): Promise<string | null> {
  const r = await oneMerge(s, () => flattenNow(s));
  return typeof r === 'string' ? r : null;
}

async function flattenNow(s: PhotoSession): Promise<void> {
  const pic = await compositeSliced(s.photo, s.lookup(), photoRect(s.photo), {
    text: rasterizeText,
  });
  const id = newLayerId(idsOf(s.photo));
  const layer = pixelLayerOf(s, { id, name: 'Background' }, pic, 0, 0);
  const edit = once(id, (p) => ({ ...p, layers: [layer] }));
  s.preview(edit(s.photo));
  s.active = id;
  s.commitPixels('Flatten Image', [{ layerId: id, target: 'layer' }], edit);
}
