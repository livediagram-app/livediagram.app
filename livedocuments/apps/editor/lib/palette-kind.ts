// The palette's kind in Pages mode (docs/specs/007-editor/pages-mode.md "The palette's kind"): which
// categories the palette offers, in what order (each kind's layout, palette-layouts.ts). Design for
// an infographic page, Slide, Article and Flashcard for theirs. In Article the strip holds the
// article's formatting (its page toolbar, docked: lib/article/article-dock.ts) in place of the
// category bar; in Flashcard the card's formatting and nothing else, no Search
// (docs/specs/007-editor/flashcards.md "Text only"). The tab's kind, known on the first paint: it is never shown or
// chosen, and never changes as someone moves between a tab's pages. Only a tab stored with pages of more than one kind
// follows the page someone is on.
import { useMemo } from 'react';
import { pageKindOf, tabPageKind, type Page, type PageKind } from '@livedocuments/document';
import { useCurrentPageKind } from './current-page-kind';

export type PaletteKind = 'design' | 'slide' | 'article' | 'flashcard';

/** The kind a page of `kind` gives the palette. */
export function paletteKindForPage(kind: PageKind | null): PaletteKind {
  return kind === 'infographic' || kind === null ? 'design' : kind;
}

/** Whether the strip holds the page toolbar in place of the category bar: an article or a card. */
export function docksPageToolbar(kind: PaletteKind): boolean {
  return kind === 'article' || kind === 'flashcard';
}

/** A tab's one kind, or null for a tab stored with pages of more than one (or off Pages mode, with no pages). */
export function soleTabKind(
  pages: readonly Pick<Page, 'kind'>[] | null | undefined,
): PageKind | null {
  if (!pages || pages.length === 0) return null;
  const kind = tabPageKind(pages);
  return pages.every((p) => pageKindOf(p) === kind) ? kind : null;
}

/** The palette's kind: its tab's, or for a tab of mixed kinds the page someone is on's. */
export function usePaletteKind(
  pages: readonly Pick<Page, 'kind'>[] | null | undefined,
): PaletteKind {
  const sole = useMemo(() => soleTabKind(pages), [pages]);
  const followed = useCurrentPageKind();
  const mixed = pages && pages.length > 0 && sole === null;
  return paletteKindForPage(mixed ? (followed ?? tabPageKind(pages)) : sole);
}
