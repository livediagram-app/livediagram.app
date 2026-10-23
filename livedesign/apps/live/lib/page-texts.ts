// The words on each page, for Contents' Find a Page (docs/specs/007-editor/pages-mode.md
// "Contents"). Apart from lib/page-contents.ts so the editor's own framing code, which reads the page in
// view, never loads the find helpers: only the Contents list does, and only while a search is typed.
import {
  buildElementIndex,
  elementAnchorPoint,
  rowPageAt,
  type Element,
  type LaidOutPage,
} from '@livedesign/design';
import { elementFindTexts } from '@livedesign/design-views';

/** The words on each page, for Find a Page: the texts of the elements on it (their labels,
 *  notes, cells, items and the rest the editor's find reads). One walk over the tab's elements. */
export function pageTexts(
  pages: readonly LaidOutPage[],
  elements: readonly Element[],
): Map<string, string> {
  const parts = new Map<string, string[]>(pages.map((p) => [p.id, []]));
  const index = buildElementIndex(elements as Element[]);
  for (const el of elements) {
    const page = rowPageAt(pages, elementAnchorPoint(el, index));
    if (page) parts.get(page.id)!.push(...elementFindTexts(el));
  }
  const out = new Map<string, string>();
  for (const p of pages) out.set(p.id, parts.get(p.id)!.join(' '));
  return out;
}
