// Pages as agents name and read them in result lines (docs/specs/024-agents/pages-for-agents.md
// "Naming a page", "change_pages"): a page found by id, place or name, its label and its size in
// words. The page summaries themselves are api-schema's (pages-summary), shared
// with the pages view.
import type { PageRef, PageSummary } from '@livedesign/api-schema';
import { pageHasOrientation, pageSizeLabel, PAGE_SIZES, type Page } from '@livedesign/document';

export { describeBackground, pageSummaries } from '@livedesign/api-schema';

/** A page's label in lines and lists: `2 Cover (slide)`, `3 (logo)`. */
export function pageLabel(page: PageSummary): string {
  return `${page.place}${page.name ? ` ${page.name}` : ''} (${page.kind})`;
}

/** A size in words for a result line: `16:9`, `A4 portrait`, `1024 x 1024`, a wireframe page's
 *  device (`iPhone`, `iPad landscape`). */
export function sizeLabel(page: Pick<Page, 'size' | 'orientation' | 'kind' | 'device'>): string {
  if (page.size === 'device') {
    const label = pageSizeLabel(page);
    return pageHasOrientation(page) && page.orientation === 'landscape'
      ? `${label} landscape`
      : label;
  }
  const size = PAGE_SIZES[page.size ?? 'a4'];
  const label = page.orientation === 'landscape' ? size.landscape : size.portrait;
  return pageHasOrientation(page) && size.short !== size.long
    ? `${label} ${page.orientation}`
    : label;
}

const nameKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();

/** The page a ref names: an id, then a 1-based place, then a name (case and spacing aside). */
export function resolvePage(pages: readonly Page[], ref: PageRef): Page | undefined {
  if (typeof ref === 'string') {
    const byId = pages.find((p) => p.id === ref);
    if (byId) return byId;
    if (/^\d+$/.test(ref.trim())) return pages[Number(ref.trim()) - 1];
    const key = nameKey(ref);
    return pages.find((p) => p.name && nameKey(p.name) === key);
  }
  return pages[ref - 1];
}
