// Which page each element is on (docs/specs/007-editor/pages-mode.md "Contents"): the rule Contents' Find a Page
// and the tab's Find and Replace (docs/specs/007-editor/find-and-replace.md "What is searched") both read. Apart
// from the find helpers, so a caller that needs only the pages never loads them.
import {
  buildElementIndex,
  elementAnchorPoint,
  rowPageAt,
  type Element,
  type LaidOutPage,
} from '@livedocuments/document';

/** The elements on each page, by page id, in the tab's order: an element is on the page its anchor (its centre; an
 *  arrow's, the midpoint of its ends) lies on. An element on no page is left out. One walk over the elements. */
export function elementsByPage(
  pages: readonly LaidOutPage[],
  elements: readonly Element[],
): Map<string, Element[]> {
  const out = new Map<string, Element[]>(pages.map((p) => [p.id, []]));
  const index = buildElementIndex(elements as Element[]);
  for (const el of elements) {
    const page = rowPageAt(pages, elementAnchorPoint(el, index));
    if (page) out.get(page.id)!.push(el);
  }
  return out;
}
