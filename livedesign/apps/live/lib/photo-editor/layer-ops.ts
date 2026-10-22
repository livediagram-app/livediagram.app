// The layer operations (docs/specs/031-photo/photo-layers.md "Layer operations"): each one edit,
// named in History by its name. Those that make pixels (merges, rasterizing, a placed picture, a
// layer via copy) composite on this thread and commit the new tiles with the stack change.
import {
  addLayer,
  ADJUSTMENTS,
  compositePhoto,
  descendantIds,
  duplicateLayers,
  effectsMargin,
  groupLayers,
  hasEffects,
  isShown,
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
  type Rect,
} from '@livedesign/photo-engine';
import type { PhotoSession } from './session';
import { rasterizeText, textBox } from './text-raster';
import { selectionMaskRaster } from './selection-mask';
import { compositeSliced } from './sliced-composite';

const idsOf = (p: Photo) => p.layers.map((l) => l.id);
const offsetOf = (l: PhotoLayer) =>
  l.layerKind === 'pixel' ? (l.offset ?? { x: 0, y: 0 }) : { x: 0, y: 0 };
const photoRect = (p: Photo): Rect => ({ x: 0, y: 0, width: p.width, height: p.height });

function union(a: Rect | null, b: Rect | null): Rect | null {
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
const plain = (l: PhotoLayer): PhotoLayer => {
  const { opacity: _o, blend: _b, mask: _m, clip: _c, parent: _p, visible: _v, ...rest } = l;
  void [_o, _b, _m, _c, _p, _v];
  return rest;
};

/** A pixel layer with these pixels (photo coordinates at `x`, `y`), the session holding them. */
function pixelLayerOf(
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
const once = (id: string, edit: (p: Photo) => Photo) => (p: Photo) =>
  p.layers.some((l) => l.id === id) ? p : edit(p);

/** A new layer with pixels committed as one edit, previewed at once. */
function commitNewLayer(
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

export function setLayerProps(
  s: PhotoSession,
  id: string,
  patch: Partial<Record<string, unknown>>,
  label: string,
): void {
  s.commitStack(setLayer(s.photo, id, patch), label);
}

/** The sibling directly under a layer. */
export function layerBelow(photo: Photo, id: string): PhotoLayer | undefined {
  const layer = photo.layers.find((l) => l.id === id);
  if (!layer) return undefined;
  const siblings = siblingsOf(photo.layers, layer.parent);
  return siblings[siblings.findIndex((l) => l.id === id) - 1];
}

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

/** A layer's settings without what only a text or fill layer has. */
function plainKeepSettings(l: PhotoLayer): Omit<PhotoLayer, 'layerKind'> {
  const { text: _t, fill: _f, ...rest } = l as PhotoLayer & { text?: unknown; fill?: unknown };
  void [_t, _f];
  return rest;
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
    const kept = p.layers.filter((l) => !gone.has(l.id) && !(l.parent && gone.has(l.parent)));
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
