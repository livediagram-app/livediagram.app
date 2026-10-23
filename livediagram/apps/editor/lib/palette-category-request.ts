// A request to show a palette category: an opener tile off the strip asks for its category (PaletteTileGrid). The
// palette, floating or toolbar, listens and switches to it when it offers it.
type Listener = (categoryId: string) => void;
const listeners = new Set<Listener>();

export function requestPaletteCategory(categoryId: string): void {
  for (const l of listeners) l(categoryId);
}

export function onPaletteCategoryRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
