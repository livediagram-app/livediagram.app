// Page links (docs/specs/030-knowledgebase/links-and-embeds.md): a run that links to another page of the same
// knowledgebase carries that page's tab id under PAGE_LINK_KEY. The one definition of the run's shape, for the
// editor that draws the link, the room that keeps the link table and the readers that follow it.
import type { ArticleFlow, ArticleRun } from '@liveknowledge/document';

/** The run field that holds a page link's target: `{ text, page: <tab id> }`. */
export const PAGE_LINK_KEY = 'page';
/** A tab id a run may link to: as long as any id an article stores. */
export const MAX_PAGE_LINK_ID = 64;
/** The most links one page's row set holds: a knowledgebase has at most 500 pages (MAX_KNOWLEDGEBASE_PAGES), so a
 *  page with more distinct targets than that is linking to ids that are not pages. */
export const MAX_PAGE_LINKS = 500;

export type PageLinkRun = ArticleRun & { page: string };

/** Whether `v` is a tab id a page link may hold. */
export const isPageLinkTarget = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= MAX_PAGE_LINK_ID;

/** Whether a run is a page link. */
export const isPageLinkRun = (run: ArticleRun): run is PageLinkRun =>
  isPageLinkTarget((run as Record<string, unknown>)[PAGE_LINK_KEY]);

/** The pages a page's writing links to: each once, in the order first linked, at most MAX_PAGE_LINKS. Table cells
 *  count; a link to a page that no longer exists is still a link (it shows as "Deleted Page"). */
export function pageLinkTargets(flow: Pick<ArticleFlow, 'blocks'>): string[] {
  const targets = new Set<string>();
  const take = (runs: readonly ArticleRun[]) => {
    for (const run of runs) if (isPageLinkRun(run)) targets.add(run.page);
  };
  for (const block of flow.blocks) {
    if (block.type === 'paragraph' || block.type === 'list') take(block.runs);
    else if (block.type === 'table') for (const row of block.rows) row.cells.forEach(take);
  }
  return [...targets].slice(0, MAX_PAGE_LINKS);
}

/** "Linked From": the pages that link to a page, in tree order. `fromTabs` are the link table's rows for the page
 *  (sql/page-index.ts `backlinkRows`), `treeOrder` every page's id in the page tree's order; a row from a page that
 *  is no longer in the tree, and the page's link to itself, are left out. */
export function backlinks(
  tab: string,
  fromTabs: readonly string[],
  treeOrder: readonly string[],
): string[] {
  const linking = new Set(fromTabs);
  linking.delete(tab);
  return treeOrder.filter((id) => linking.has(id));
}
