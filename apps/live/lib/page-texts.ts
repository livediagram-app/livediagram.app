// The words on each Illustrate page, for Contents' Find a Page (docs/specs/007-editor/illustrate-pages.md
// "Contents"). Apart from lib/page-contents.ts so the editor's own framing code, which reads the page in
// view, never loads the find helpers: only the Contents list does, and only while a search is typed.
import {
  buildElementIndex,
  elementAnchorPoint,
  rowPageAt,
  type ArticleFlow,
  type Element,
  type LaidOutPage,
} from '@livediagram/document';
import { elementFindTexts } from '@livediagram/document-views';

/** The words on each page, for Find a Page: the texts of the elements on it (their labels,
 *  notes, cells, items and the rest the editor's find reads) and, on an article's page, the
 *  article's writing. One walk over the tab's elements. */
export function pageTexts(
  pages: readonly LaidOutPage[],
  elements: readonly Element[],
  articles: Readonly<Record<string, ArticleFlow>> = {},
): Map<string, string> {
  const parts = new Map<string, string[]>(pages.map((p) => [p.id, []]));
  const index = buildElementIndex(elements as Element[]);
  for (const el of elements) {
    const page = rowPageAt(pages, elementAnchorPoint(el, index));
    if (page) parts.get(page.id)!.push(...elementFindTexts(el));
  }
  const out = new Map<string, string>();
  for (const p of pages) {
    const flow = p.flow ? articles[p.flow] : undefined;
    const writing = flow ? flow.blocks.map(blockText).join(' ') : '';
    out.set(p.id, `${parts.get(p.id)!.join(' ')} ${writing}`);
  }
  return out;
}

function blockText(block: ArticleFlow['blocks'][number]): string {
  if ('runs' in block) return block.runs.map((r) => r.text).join('');
  return block.type === 'code' ? block.text : '';
}
