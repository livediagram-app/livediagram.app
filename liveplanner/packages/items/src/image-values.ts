// The pictures an Image field holds (docs/specs/026-plan/item-types.md "Image fields"): one image id, or, on a
// Several Images field (`multiple: true` on an Image field), a list of up to IMAGE_FIELD_PICTURES_MAX ids in the order
// people arranged them. One reading, both ways, as Holds Several reads people and cards (several-values.ts): a field
// holding several reads a single stored id as a list of one, and a field holding one reads a stored list as its first
// picture, so changing one into the other never rewrites a card. Pure.
import type { ItemFieldValue } from './item';
import type { CustomFieldDef } from './item-types';
import { FIELD_VALUES_MAX } from './limits';

// The most pictures a Several Images field holds: as many as Holds Several's values and a card's Attachments.
export const IMAGE_FIELD_PICTURES_MAX = FIELD_VALUES_MAX;

type ImageField = Pick<CustomFieldDef, 'kind' | 'multiple'> | undefined;

// Whether a field is a Several Images field: an Image field switched to hold several.
export const holdsSeveralImages = (field: ImageField): boolean =>
  !!field && field.kind === 'image' && field.multiple === true;

// Every image id a stored value holds, each once, in order: a single id as one, a list's ids (at most
// IMAGE_FIELD_PICTURES_MAX), anything else none.
export function storedImageIds(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const id of list) {
    if (out.length >= IMAGE_FIELD_PICTURES_MAX) break;
    if (typeof id === 'string' && id && !out.includes(id)) out.push(id);
  }
  return out;
}

// The pictures an Image field shows: all of them on a Several Images field, else the first.
export function fieldImageIds(field: ImageField, value: unknown): string[] {
  const all = storedImageIds(value);
  return holdsSeveralImages(field) ? all : all.slice(0, 1);
}

// The value to store for an Image field from its pictures: the list (each once, at most IMAGE_FIELD_PICTURES_MAX) on a
// Several Images field, else the first; undefined (clear the field) when there are none.
export function imageFieldValue(
  field: ImageField,
  ids: readonly string[],
): ItemFieldValue | undefined {
  const kept = storedImageIds(ids);
  if (kept.length === 0) return undefined;
  return holdsSeveralImages(field) ? kept : kept[0];
}

// `ids` with `added` at the end, each id not held already, up to IMAGE_FIELD_PICTURES_MAX. `skipped` is how many did
// not fit.
export function withImagesAdded(
  ids: readonly string[],
  added: readonly string[],
): { ids: string[]; skipped: number } {
  const out = [...ids];
  let skipped = 0;
  for (const id of added) {
    if (!id || out.includes(id)) continue;
    if (out.length >= IMAGE_FIELD_PICTURES_MAX) skipped++;
    else out.push(id);
  }
  return { ids: out, skipped };
}

// `ids` without any of `removed`.
export function withoutImages(ids: readonly string[], removed: readonly string[]): string[] {
  return ids.filter((id) => !removed.includes(id));
}

// `ids` with the picture at `from` moved to `to`; the same list when either is outside it.
export function movedImage(ids: readonly string[], from: number, to: number): string[] {
  const out = [...ids];
  if (!Number.isInteger(from) || !Number.isInteger(to)) return out;
  if (from < 0 || to < 0 || from >= out.length || to >= out.length) return out;
  const [moved] = out.splice(from, 1);
  out.splice(to, 0, moved!);
  return out;
}
