// The Library is always the palette's last category (liveworkspace/docs/specs/006-media/libraries.md
// "The Library comes last"), in every app and layout that offers it, never mixed in among the others: it holds what
// people saved, not what the app ships, so it closes the bar where it is always found.

/** The categories in their order, with the Library's (by its id in this app) moved to the end. */
export function libraryLast<C extends { id: string }>(categories: readonly C[], libraryId: string): C[] {
  const library = categories.find((c) => c.id === libraryId);
  if (!library) return [...categories];
  return [...categories.filter((c) => c !== library), library];
}
