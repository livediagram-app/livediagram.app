// Layer operations on the stack alone (docs/specs/031-photo/photo-layers.md "Layer operations"): add,
// remove, duplicate, move, step, set, group and ungroup. Each returns the next photo (the input is
// never changed); the operations that need pixels (merges, rasterizing) build their new layers in
// the session and land through these.
import { newLayerId } from './ids';
import { copyName } from './names';
import { ancestorIds, descendantIds, normaliseStack } from './stack';
import type { GroupLayer, Photo, PhotoLayer } from './types';

const withLayers = (photo: Photo, layers: PhotoLayer[]): Photo => ({
  ...photo,
  layers: normaliseStack(layers),
});

function indexOf(layers: readonly PhotoLayer[], id: string): number {
  return layers.findIndex((l) => l.id === id);
}

/** The index the block of a layer starts at: a group's first descendant, else the layer itself. */
function blockStart(layers: readonly PhotoLayer[], id: string): number {
  const at = indexOf(layers, id);
  const inside = descendantIds(layers, id);
  return inside.length > 0 ? indexOf(layers, inside[0]!) : at;
}

/** `layer` added directly above `above` (in its group), or on top of the stack without one. */
export function addLayer(photo: Photo, layer: PhotoLayer, above?: string): Photo {
  const layers = [...photo.layers];
  const at = above ? indexOf(layers, above) : -1;
  if (at < 0) {
    const { parent: _drop, ...top } = layer;
    void _drop;
    return withLayers(photo, [...layers, top]);
  }
  const ref = layers[at]!;
  const placed = { ...layer, ...(ref.parent ? { parent: ref.parent } : {}) };
  if (!ref.parent) delete (placed as { parent?: string }).parent;
  layers.splice(at + 1, 0, placed);
  return withLayers(photo, layers);
}

/** The layers removed, with every layer inside a removed group. */
export function removeLayers(photo: Photo, ids: readonly string[]): Photo {
  const gone = new Set<string>();
  for (const id of ids) {
    gone.add(id);
    for (const d of descendantIds(photo.layers, id)) gone.add(d);
  }
  return { ...photo, layers: photo.layers.filter((l) => !gone.has(l.id)) };
}

/** A patch to one layer's fields; `undefined` values clear a field. */
export function setLayer(photo: Photo, id: string, patch: Partial<Record<string, unknown>>): Photo {
  let changed = false;
  const layers = photo.layers.map((l) => {
    if (l.id !== id) return l;
    changed = true;
    const next: Record<string, unknown> = { ...l, ...patch };
    for (const [k, v] of Object.entries(patch)) if (v === undefined) delete next[k];
    next.id = l.id;
    next.layerKind = l.layerKind;
    return next as PhotoLayer;
  });
  return changed ? withLayers(photo, layers) : photo;
}

/** Each layer (with a group's layers) copied directly above its block, the copies new ids and
 *  named "<name> Copy" (a group's layers keep their names). Answers the photo and the copies' ids
 *  in place of the originals, top-level ones only. */
export function duplicateLayers(
  photo: Photo,
  ids: readonly string[],
): { photo: Photo; copies: string[] } {
  let layers = [...photo.layers];
  const copies: string[] = [];
  const taken = new Set(layers.map((l) => l.id));
  // Skip ids inside another duplicated group: they come with it.
  const roots = ids.filter((id) => !ancestorIds(layers, id).some((a) => ids.includes(a)));
  for (const id of roots) {
    const at = indexOf(layers, id);
    if (at < 0) continue;
    const blockIds = [...descendantIds(layers, id), id];
    const map = new Map<string, string>();
    for (const b of blockIds) {
      const fresh = newLayerId(taken);
      taken.add(fresh);
      map.set(b, fresh);
    }
    const block = blockIds.map((b) => {
      const l = layers[indexOf(layers, b)]!;
      const copy = { ...l, id: map.get(b)! };
      if (b === id) copy.name = copyName(l.name);
      if (l.parent && map.has(l.parent)) copy.parent = map.get(l.parent)!;
      return copy;
    });
    layers = [...layers.slice(0, at + 1), ...block, ...layers.slice(at + 1)];
    copies.push(map.get(id)!);
  }
  return { photo: withLayers(photo, layers), copies };
}

export type LayerMoveTo =
  | { above: string }
  | { below: string }
  // Into a group, on top of its layers.
  | { into: string }
  | { top: true }
  | { bottom: true };

/** The layer (with its group's layers) moved to a new place; refused (the same photo back) when the
 *  place is inside itself. */
export function moveLayer(photo: Photo, id: string, to: LayerMoveTo): Photo {
  const layers = photo.layers;
  const at = indexOf(layers, id);
  if (at < 0) return photo;
  const blockIds = new Set([...descendantIds(layers, id), id]);
  const target =
    'above' in to ? to.above : 'below' in to ? to.below : 'into' in to ? to.into : null;
  if (target && blockIds.has(target)) return photo;
  if ('into' in to && layers[indexOf(layers, to.into)]?.layerKind !== 'group') return photo;
  const block = layers.filter((l) => blockIds.has(l.id));
  const rest = layers.filter((l) => !blockIds.has(l.id));
  let parent: string | undefined;
  let insertAt: number;
  if ('top' in to) {
    parent = undefined;
    insertAt = rest.length;
  } else if ('bottom' in to) {
    parent = undefined;
    insertAt = 0;
  } else if ('into' in to) {
    parent = to.into;
    insertAt = indexOf(rest, to.into);
  } else if ('above' in to) {
    const ref = rest[indexOf(rest, to.above)];
    if (!ref) return photo;
    parent = ref.parent;
    insertAt = indexOf(rest, to.above) + 1;
  } else {
    const ref = rest[indexOf(rest, to.below)];
    if (!ref) return photo;
    parent = ref.parent;
    insertAt = blockStart(rest, to.below);
  }
  const moved = block.map((l) => {
    if (l.id !== id) return l;
    const next = { ...l };
    if (parent) next.parent = parent;
    else delete next.parent;
    return next;
  });
  return withLayers(photo, [...rest.slice(0, insertAt), ...moved, ...rest.slice(insertAt)]);
}

/** The layer stepped one place up (`+1`) or down (`-1`) among its siblings; at the end of its group
 *  it stays. */
export function stepLayer(photo: Photo, id: string, by: 1 | -1): Photo {
  const layer = photo.layers.find((l) => l.id === id);
  if (!layer) return photo;
  const siblings = photo.layers.filter((l) => l.parent === layer.parent);
  const i = siblings.findIndex((l) => l.id === id);
  const next = siblings[i + by];
  if (!next) return photo;
  return moveLayer(photo, id, by === 1 ? { above: next.id } : { below: next.id });
}

/** The layers put into a new group at the top-most one's place. Answers the group's id. */
export function groupLayers(
  photo: Photo,
  ids: readonly string[],
  name: string,
): { photo: Photo; group: string } | undefined {
  const layers = photo.layers;
  // Only the outermost of the chosen layers: a chosen group brings its own.
  const chosen = ids.filter(
    (id) => indexOf(layers, id) >= 0 && !ancestorIds(layers, id).some((a) => ids.includes(a)),
  );
  if (chosen.length === 0) return undefined;
  const top = chosen.reduce((a, b) => (indexOf(layers, a) > indexOf(layers, b) ? a : b));
  const parent = layers[indexOf(layers, top)]!.parent;
  const group: GroupLayer = {
    id: newLayerId(layers.map((l) => l.id)),
    name,
    layerKind: 'group',
    ...(parent ? { parent } : {}),
  };
  let next = addLayer(photo, group, top);
  // addLayer took `top`'s parent; reparent each chosen layer into the group, keeping their order.
  const order = chosen.sort((a, b) => indexOf(layers, a) - indexOf(layers, b));
  for (const id of order) next = moveLayer(next, id, { into: group.id });
  // `into` puts each on top of the group, so the loop bottom-first keeps their order.
  return { photo: next, group: group.id };
}

/** A group's layers out to its place, the group gone. */
export function ungroup(photo: Photo, groupId: string): Photo {
  const group = photo.layers.find((l) => l.id === groupId);
  if (!group || group.layerKind !== 'group') return photo;
  const layers = photo.layers
    .filter((l) => l.id !== groupId)
    .map((l) => {
      if (l.parent !== groupId) return l;
      const next = { ...l };
      if (group.parent) next.parent = group.parent;
      else delete next.parent;
      return next;
    });
  return withLayers(photo, layers);
}

/** The photo's size changed (the layers' pixels are the session's to change). */
export function withPhotoSize(photo: Photo, width: number, height: number): Photo {
  return photo.width === width && photo.height === height ? photo : { ...photo, width, height };
}
