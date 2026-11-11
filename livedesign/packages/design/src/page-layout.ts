// Where the pages sit (docs/specs/007-editor/pages-mode.md "The pages"): the row anchor, each page's margin, the
// row they are laid out in, and which page a point is on. Re-exported from ./page.
import type { RowAt } from '@liveworkspace/model-core/page-fit';
import { A4_LONG_SIDE, LOGO_SAFE_FRACTION, PAGE_GAP, pageDimensions } from './page-sizes';
import type { LaidOutPage, Page, PageRect } from './page';

export function rowAnchorOf(pages: readonly Pick<Page, 'rowAt'>[]): RowAt {
  return pages.find((p) => p.rowAt)?.rowAt ?? { x: 0, y: 0 };
}

/** The tab's pages, in order: its stored ones, or one page in its legacy orientation (portrait
 *  unless it said landscape). Never empty; malformed entries, and a repeat of an id already seen,
 *  are skipped. */
export function pageMargin(page: Pick<Page, 'orientation' | 'size' | 'fit'>): number {
  const { width, height } = pageDimensions(page);
  if (page.size === 'photo') return 0;
  const fraction = page.size === 'logo' ? LOGO_SAFE_FRACTION : PAGE_MARGIN_FRACTION;
  return Math.round(Math.min(width, height) * fraction);
}

// A page's margin as a share of its short side (docs/specs/007-editor/pages-mode.md).
const PAGE_MARGIN_FRACTION = 0.07;

/** Where each page sits: the first centred on the origin, each further one a gap to the right,
 *  every page centred on the row's horizontal axis (y = 0). */
export function layOutPages(pages: readonly Page[]): LaidOutPage[] {
  const at = rowAnchorOf(pages);
  let x = 0;
  return pages.map((page, index) => {
    const { width, height } = pageDimensions(page);
    if (index === 0) x = at.x - width / 2;
    const rect = { x, y: at.y - height / 2, width, height };
    x += width + PAGE_GAP;
    return { ...page, index, rect };
  });
}

/** The box the view fits to frame a page (the first by default): the page itself, so it fills the
 *  screen whatever its shape (a landscape page on a wide screen too). With no page, a square of
 *  an A4 long side at the origin. */
export function pageFitBox(page?: Pick<LaidOutPage, 'rect'>): PageRect {
  if (!page) {
    return {
      x: -A4_LONG_SIDE / 2,
      y: -A4_LONG_SIDE / 2,
      width: A4_LONG_SIDE,
      height: A4_LONG_SIDE,
    };
  }
  return page.rect;
}

function contains(r: PageRect, p: { x: number; y: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/** The page a canvas point lies on (edges included), if any. */
export function pageAt(
  pages: readonly LaidOutPage[],
  point: { x: number; y: number },
): LaidOutPage | undefined {
  return pages.find((p) => contains(p.rect, point));
}

/** The page of a laid-out row (as layOutPages answers it: left to right, never
 *  overlapping) a point lies on, found by halving: the walk over a tab's elements asks once each. */
export function rowPageAt(
  row: readonly LaidOutPage[],
  point: { x: number; y: number },
): LaidOutPage | undefined {
  let lo = 0;
  let hi = row.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (row[mid]!.rect.x <= point.x) lo = mid;
    else hi = mid - 1;
  }
  const page = row[lo];
  return page && contains(page.rect, point) ? page : undefined;
}

/** A new page's id: never one a page has had before, so anything that named a deleted page never
 *  finds a new page under its old id. Random, checked against the
 *  tab's pages. */
