// The pictures a page's thumbnail draws (docs/specs/007-editor/pages-mode.md "Contents"): its image
// elements' and its picture fill's gallery ids, for useImageSources to fetch, and the resolver the
// headless renderer takes, which hands an Offline Mode picture (its bytes as a data: URI) back as it is.
import { elementsImageIds, type Element, type PageBackground } from '@livedocuments/document';

/** The image ids a thumbnail of these elements on this page shows (inline ones included). */
export function thumbImageIds(
  elements: readonly Element[],
  page: { background?: PageBackground } | undefined,
): string[] {
  const ids: string[] = [];
  const fill = page?.background?.fill;
  if (fill?.kind === 'image') ids.push(fill.imageId);
  // An image's picture and a quote's photo (docs/specs/009-elements/quote.md).
  ids.push(...elementsImageIds(elements));
  return ids;
}

/** A picture's URL by id: an inline one is its own, a gallery one what `source` holds (or nothing yet). */
export function thumbImageHref(
  source: (imageId: string) => string | undefined,
): (imageId: string) => string | undefined {
  return (id) => (id.startsWith('data:') ? id : source(id));
}
