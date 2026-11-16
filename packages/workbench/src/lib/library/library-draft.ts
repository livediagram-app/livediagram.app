// A selection as a Library item to save (liveworkspace/docs/specs/006-media/libraries.md "What an item is"): its
// elements copied with fresh ids by the editor's own paste copy, moved so their bounds start at (0, 0), the size of
// those bounds, and a name to suggest. Each editor binds its own element helpers.

import type { LibrarySaveDraft } from '../../components/library/LibraryProvider';

type LibraryElement = { id: string; type: string };

export type LibraryDraftHelpers<E extends LibraryElement> = {
  duplicate: (elements: E[], ids: ReadonlySet<string>, dx: number, dy: number) => E[];
  bounds: (elements: E[]) => { x: number; y: number; w: number; h: number };
  // What the editor calls an element's kind ("Square", "Sticky Note"), for a name when none is written on it.
  kindLabel: (element: E) => string;
};

// The longest name suggested; the person can type up to LIBRARY_TITLE_MAX.
const SUGGESTED_TITLE_MAX = 60;

// The first words written on the selection, else the first element's kind, else "Selection".
export function suggestedLibraryTitle<E extends LibraryElement>(
  elements: readonly E[],
  kindLabel: (element: E) => string,
): string {
  for (const el of elements) {
    const label = (el as { label?: unknown }).label;
    if (typeof label !== 'string') continue;
    const line = label
      .split('\n')
      .find((l) => l.trim() !== '')
      ?.trim();
    if (line) return line.slice(0, SUGGESTED_TITLE_MAX);
  }
  const first = elements.find((el) => el.type !== 'arrow') ?? elements[0];
  return first ? kindLabel(first).slice(0, SUGGESTED_TITLE_MAX) : 'Selection';
}

export function libraryDraft<E extends LibraryElement>(
  selection: readonly E[],
  helpers: LibraryDraftHelpers<E>,
): LibrarySaveDraft | null {
  const elements = [...selection];
  if (elements.length === 0) return null;
  const b = helpers.bounds(elements);
  const moved = helpers.duplicate(elements, new Set(elements.map((el) => el.id)), -b.x, -b.y);
  if (moved.length === 0) return null;
  return {
    width: Math.max(0, b.w),
    height: Math.max(0, b.h),
    elements: moved,
    suggestedTitle: suggestedLibraryTitle(elements, helpers.kindLabel),
  };
}
