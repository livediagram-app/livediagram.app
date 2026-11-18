// A Library tile's drag (liveworkspace/docs/specs/006-media/libraries.md "Placing: a click or a drag"): the item's id
// alone, under one type every editor's canvas takes. The canvas finds the item in the list it already holds and asks
// the door for its elements on drop.

export const LIBRARY_ITEM_DND_MIME = 'application/x-liveworkspace-library-item';

const ID_MAX = 256;

/** A tile's drag payload for the item `id`. */
export function libraryItemDrag(id: string): { mime: string; data: string } {
  return { mime: LIBRARY_ITEM_DND_MIME, data: JSON.stringify({ id }) };
}

/** The item id a drop carries, or null for anything else. */
export function readLibraryItemDrop(data: string): string | null {
  if (!data) return null;
  try {
    const parsed: unknown = JSON.parse(data);
    const id = (parsed as { id?: unknown } | null)?.id;
    return typeof id === 'string' && id.length > 0 && id.length <= ID_MAX ? id : null;
  } catch {
    return null;
  }
}
