// Every blob a tab's photos name now (docs/specs/031-photo/photo-store.md "Retention"): each layer's
// and mask's tiles and source, and each photo's preview. The api's sweep keeps these and lets the rest
// go; a copy carries them.
import { photosOf } from './parse';
import type { LayerPixels, Photo } from './types';

function addPixels(out: Set<string>, pixels: LayerPixels | undefined): void {
  if (!pixels) return;
  for (const id of Object.values(pixels.tiles)) if (id) out.add(id);
  if (pixels.source) out.add(pixels.source.blob);
}

/** The blob ids one photo names. */
export function photoBlobIds(photo: Photo): Set<string> {
  const out = new Set<string>();
  if (photo.preview) out.add(photo.preview);
  for (const layer of photo.layers) {
    if (layer.layerKind === 'pixel') addPixels(out, layer.pixels);
    addPixels(out, layer.mask?.pixels);
  }
  return out;
}

/** The blob ids every photo of the tab names. */
export function photoBlobIdsOf(tab: { photos?: unknown } | undefined): Set<string> {
  const out = new Set<string>();
  for (const photo of Object.values(photosOf(tab)))
    for (const id of photoBlobIds(photo)) out.add(id);
  return out;
}
