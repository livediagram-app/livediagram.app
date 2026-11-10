// The gallery picture an element places (docs/specs/009-elements/quote.md "The slots", images.md): an image's, and a
// quote's portrait photo. Every reader that gathers a tab's pictures (exports, thumbnails, offline copies, the
// reference index's client mirror) asks this rather than `type === 'image'`, so a quote's photo is kept, embedded and
// taken offline exactly as an image's is.

import type { Element } from './index';

/** The picture `el` places, or null. */
export function elementImageId(el: Element): string | null {
  if (el.type === 'image') return el.imageId;
  if (el.type === 'shape' && el.shape === 'quote' && typeof el.imageId === 'string' && el.imageId)
    return el.imageId;
  return null;
}

/** Every picture `elements` place, in order, each once. */
export function elementsImageIds(elements: readonly Element[]): string[] {
  const ids = new Set<string>();
  for (const el of elements) {
    const id = elementImageId(el);
    if (id) ids.add(id);
  }
  return [...ids];
}

/** `el` with its picture swapped through `mapping` (an offline copy's gallery id to data: URI, and back). */
export function withMappedImageId<E extends Element>(
  el: E,
  mapping: ReadonlyMap<string, string>,
): E {
  const id = elementImageId(el);
  if (!id) return el;
  const next = mapping.get(id);
  return next && next !== id ? { ...el, imageId: next } : el;
}
