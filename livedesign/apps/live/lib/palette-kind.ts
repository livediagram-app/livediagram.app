// The palette's kind in Pages mode (docs/specs/007-editor/pages-mode.md "The palette's kind"): which
// categories the palette offers, in what order (each kind's layout, palette-layouts.ts). Design for
// a blank page and a photo page (whose own tools stand in for the categories), Wireframe and Logo for theirs. The
// tab's kind, known on the first paint: it is never shown or chosen, and never changes as someone moves between a
// tab's pages. Only a tab stored with pages of more than one kind follows the page someone is on.
import { useMemo } from 'react';
import { pageKindOf, tabPageKind, type Page, type PageKind } from '@livedesign/design';
import { useCurrentPageKind } from './current-page-kind';

export type PaletteKind = 'design' | 'wireframe' | 'logo';

// The category each kind opens on: Popular for Design (the bar has no Popular, so the strip keeps
// what it shows), Elements for Wireframe, Draw for Logo.
export const PALETTE_KIND_LANDING: Readonly<Record<PaletteKind, string>> = {
  design: 'popular',
  wireframe: 'wireframe',
  logo: 'draw',
};

/** The kind a page of `kind` gives the palette. */
export function paletteKindForPage(kind: PageKind | null): PaletteKind {
  return kind === 'logo' || kind === 'wireframe' ? kind : 'design';
}

/** A tab's one kind, or null for a tab stored with pages of more than one (or off Pages mode, with no pages).
 *  A tab of blank pages is one kind too: null, which is Design. */
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
  const mixed =
    !!pages && pages.length > 0 && pages.some((p) => pageKindOf(p) !== tabPageKind(pages));
  return paletteKindForPage(mixed ? (followed ?? tabPageKind(pages)) : sole);
}
