// What the + beside the last page adds (docs/specs/007-editor/pages-mode.md "Adding a page"):
// another page like the last, named for what it is ("Add Another Slide", "Add Another iPhone
// Screen"), so the button says exactly what a press makes.
import { pageKindOf, WIREFRAME_DEVICES, type Page, type PageKind } from '@livepages/document';

const KIND_NOUN: Record<PageKind, string> = {
  infographic: 'Infographic Page',
  article: 'Article',
  slide: 'Slide',
  logo: 'Logo Page',
  wireframe: 'Screen',
};

/** The page a press of the + adds, in words: its kind, a wireframe page's device with it. */
export function anotherPageNoun(page: Pick<Page, 'kind' | 'device'>): string {
  const kind = pageKindOf(page);
  if (kind !== 'wireframe') return KIND_NOUN[kind];
  const device = page.device ?? 'iphone';
  const label = WIREFRAME_DEVICES[device].label;
  // A browser shows a page, a watch a face; every other device a screen.
  return device === 'browser'
    ? 'Browser Page'
    : device === 'watch'
      ? 'Watch Face'
      : `${label} Screen`;
}

/** The + button's name: "Add Another Slide". */
export function addAnotherLabel(page: Pick<Page, 'kind' | 'device'>): string {
  return `Add Another ${anotherPageNoun(page)}`;
}
