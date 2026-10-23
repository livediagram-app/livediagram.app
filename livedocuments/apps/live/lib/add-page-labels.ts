// What the + beside the last page adds (docs/specs/007-editor/pages-mode.md "Adding a page"):
// another page like the last, named for what it is ("Add Another Slide"), so the button says
// exactly what a press makes.
import { pageKindOf, type Page, type PageKind } from '@livedocuments/document';

const KIND_NOUN: Record<PageKind, string> = {
  infographic: 'Infographic Page',
  article: 'Article',
  slide: 'Slide',
};

/** The page a press of the + adds, in words: its kind. */
export function anotherPageNoun(page: Pick<Page, 'kind'>): string {
  return KIND_NOUN[pageKindOf(page)];
}

/** The + button's name: "Add Another Slide". */
export function addAnotherLabel(page: Pick<Page, 'kind'>): string {
  return `Add Another ${anotherPageNoun(page)}`;
}
