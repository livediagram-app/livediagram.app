// The arrow keys between pages (docs/specs/007-editor/pages-mode.md "Getting around the pages"): with
// nothing selected, Right and Down go to the next page, Left and Up to the previous, from the page
// someone is on (the first before one is known). When that page is gone, Right lands on the first page
// and Left on the last, rather than stepping from the first and skipping it. Pure.

/** The page an arrow goes to from `currentId`, or null at that end of the row. */
export function pageStep(
  pages: readonly { id: string }[],
  currentId: string | null,
  dir: 1 | -1,
): string | null {
  const at = currentId ? pages.findIndex((p) => p.id === currentId) : 0;
  if (at === -1) return (dir === 1 ? pages[0] : pages.at(-1))?.id ?? null;
  return pages[at + dir]?.id ?? null;
}

/** The step an arrow key makes: Right and Down forward, Left and Up back. */
export function arrowPageDir(key: string): 1 | -1 | null {
  return key === 'ArrowRight' || key === 'ArrowDown'
    ? 1
    : key === 'ArrowLeft' || key === 'ArrowUp'
      ? -1
      : null;
}
