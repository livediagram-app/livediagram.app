'use client';

// The elements a locked page holds (docs/specs/007-editor/illustrate-pages.md "Locking a page"),
// inert as on a locked layer. Empty outside Illustrate mode (no pages given) or with no lock.
import { useMemo } from 'react';
import { elementsOnLockedPages, type Element, type LaidOutPage } from '@livediagram/document';

const NONE: ReadonlySet<string> = new Set();

export function usePageLockedIds(
  elements: Element[],
  pages: readonly LaidOutPage[] | null,
): ReadonlySet<string> {
  return useMemo(() => {
    if (!pages?.some((p) => p.locked === true)) return NONE;
    return elementsOnLockedPages(elements, pages);
  }, [elements, pages]);
}
