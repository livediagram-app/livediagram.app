// A request to show a palette category (docs/specs/026-plan/board-widgets.md "The header"): a board's +
// asks for Widgets. The palette, floating or toolbar, listens and switches to it when it offers it.
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
