// The Poster (docs/specs/009-elements/poster.md): a picture frame on a wall whose picture an Editor chooses through the
// image picker. Its picture is a gallery id on the piece (`imageId`, as an Image element's) and, from a search pick, its
// credit. Pure: no React, no DOM.

import type { ImageCredit } from '@liveworkspace/model-core/image-credit';
import type { Element, ShapeElement } from './index';

/** The longest gallery id a poster keeps (the media contract's, @liveworkspace/media gallery-id.ts). */
export const POSTER_IMAGE_ID_MAX = 128;

/**
 * Whether a stored value is a poster's picture: a gallery id, or in Offline Mode the picture's own bytes as a
 * `data:image/` URI, as an Image element's `imageId` holds them (docs/specs/006-document/offline-mode.md).
 */
export function isPosterImageId(v: unknown): v is string {
  if (typeof v !== 'string' || v.length === 0) return false;
  return v.length <= POSTER_IMAGE_ID_MAX || v.startsWith('data:image/');
}

/** Whether an element is a Poster. */
export function isPoster(el: Element | null | undefined): el is ShapeElement {
  return !!el && el.type === 'shape' && el.shape === 'poster';
}

/** The gallery id a poster frames, or null while it is empty (or for any other element). */
export function posterPicture(el: Element | null | undefined): string | null {
  return isPoster(el) && isPosterImageId(el.imageId) ? el.imageId : null;
}

/**
 * The poster with `image` as its picture ("Choosing its picture"): a search pick's credit goes with it, any other pick
 * drops the old credit so it never describes a picture that is gone. Its box stays as it is.
 */
export function withPosterPicture(
  el: ShapeElement,
  image: { id: string; credit?: ImageCredit },
): ShapeElement {
  const { credit: _old, ...rest } = el;
  void _old;
  return { ...rest, imageId: image.id, ...(image.credit ? { credit: image.credit } : {}) };
}

/** The poster empty again: no picture, no credit, its box kept. */
export function withoutPosterPicture(el: ShapeElement): ShapeElement {
  const { imageId: _id, credit: _credit, ...rest } = el;
  void _id;
  void _credit;
  return rest;
}
