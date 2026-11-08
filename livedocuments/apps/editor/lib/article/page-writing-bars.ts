// Every page's writing as soft bars at once (docs/specs/008-canvas/canvas-performance.md "Pictures of every
// page"): what pageWritingBars gives one page, for a whole row of pages in one pass over each article's
// bars. Asking page by page filtered the whole article's bars once per page, so the Contents pictures
// and the Map of a 100-page article walked about half a million bars on every settle.
import type { ArticleDrawOp, LaidOutPage } from '@livedocuments/document';
import { articleHandleOf } from './article-editor-store';
import { pageWritingBars, WRITING_BAR_INK } from './article-export';

type Bar = Extract<ArticleDrawOp, { k: 'rect' }>;

// Whether a bar belongs to a page: the predicate pageWritingBars keeps a bar by.
const onPage = (op: Bar, r: LaidOutPage['rect']) =>
  op.x >= r.x - 1 && op.x <= r.x + r.width && op.y >= r.y - 1 && op.y <= r.y + r.height;

/** Each article page's bars, by page id, exactly as pageWritingBars gives them page by page. Pages
 *  that are not an article's are left out. */
export function writingBarsByPage(
  pages: readonly LaidOutPage[],
  ink?: string,
  source?: object,
): Map<string, ArticleDrawOp[]> {
  const out = new Map<string, ArticleDrawOp[]>();
  const byFlow = new Map<string, LaidOutPage[]>();
  for (const page of pages) {
    if (!page.flow) continue;
    let list = byFlow.get(page.flow);
    if (!list) byFlow.set(page.flow, (list = []));
    list.push(page);
  }
  for (const [flow, own] of byFlow) {
    const handle = articleHandleOf(flow);
    // An article with no editor draws from its estimated lines, page by page as before.
    if (!handle) {
      for (const page of own) out.set(page.id, pageWritingBars(page, ink, source));
      continue;
    }
    const bars = handle.bars(ink ?? WRITING_BAR_INK);
    // The pages by their left edge, so each bar finds its page by a binary search.
    const sorted = [...own].sort((a, b) => a.rect.x - b.rect.x);
    const lists = sorted.map(() => [] as ArticleDrawOp[]);
    for (const op of bars) {
      if (op.k !== 'rect') continue;
      // The last page whose left edge (less the 1 px slack) is at or before the bar.
      let lo = 0;
      let hi = sorted.length - 1;
      let at = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid]!.rect.x - 1 <= op.x) {
          at = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      // Pages that overlap across (a column of pages) are checked too, as the page-by-page filter would.
      for (let i = at; i >= 0 && sorted[i]!.rect.x + sorted[i]!.rect.width >= op.x - 1; i--) {
        if (onPage(op, sorted[i]!.rect)) lists[i]!.push(op);
      }
    }
    sorted.forEach((page, i) => out.set(page.id, lists[i]!));
  }
  return out;
}

/** Whether two pages' bars draw the same: the same bars in the same order. */
export function sameBars(a: readonly ArticleDrawOp[], b: readonly ArticleDrawOp[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x === y) continue;
    if (x.k !== 'rect' || y.k !== 'rect') return false;
    if (
      x.x !== y.x ||
      x.y !== y.y ||
      x.w !== y.w ||
      x.h !== y.h ||
      x.fill !== y.fill ||
      x.r !== y.r
    )
      return false;
  }
  return true;
}
