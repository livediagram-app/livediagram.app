// The palette's kind in Pages mode (docs/specs/007-editor/pages-mode.md "The palette's kind"): which
// categories the palette offers, in what order (each kind's layout, palette-layouts.ts). Design for
// an infographic page, Slide, Article, Wireframe and Logo for theirs. In Article the strip holds the
// article's formatting (its page toolbar, docked: lib/article/article-dock.ts) in place of the
// category bar. Always the kind of the page someone is on: it is never shown or chosen.
import type { PageKind } from '@livedocuments/document';
import { useCurrentPageKind } from './current-page-kind';

export type PaletteKind = 'design' | 'slide' | 'article' | 'wireframe' | 'logo';

// The category a kind opens on, where it has one of its own: Elements for Wireframe, Draw for Logo. Design, Slide
// and Article open on none: the strip keeps what it shows.
export const PALETTE_KIND_LANDING: Readonly<Record<PaletteKind, string | null>> = {
  design: null,
  slide: null,
  article: null,
  wireframe: 'wireframe',
  logo: 'draw',
};

/** The kind a page of `kind` gives the palette. */
export function paletteKindForPage(kind: PageKind | null): PaletteKind {
  return kind === 'infographic' || kind === null ? 'design' : kind;
}

/** The palette's kind: the page someone is on's. */
export function usePaletteKind(): PaletteKind {
  return paletteKindForPage(useCurrentPageKind());
}
