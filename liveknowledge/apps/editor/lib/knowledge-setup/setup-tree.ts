// The Review step's state (docs/specs/030-knowledgebase/describe-to-set-up.md "The flow"): the suggested pages,
// each ticked or not and with the title the person gave it. Pure: every change answers a new list, the pages in
// tree order as they came (a parent always before its subpages).
import {
  MAX_KNOWLEDGEBASE_PAGES,
  MAX_PAGE_DEPTH,
  truncateName,
  type PageTreeRefusal,
} from '@liveknowledge/document';
import type { KnowledgeSetupPage } from '@liveknowledge/api-schema';
import { SETUP_MAX_TITLE_CHARS } from '@liveknowledge/knowledge';
import { TIER_NAMES } from '@liveworkspace/subscription';
import { pagesTierOf } from '@/lib/knowledge-import/import-trim';
import { openPagesBound, openPagesMax } from '@/lib/knowledge-tier';

export type ReviewPage = KnowledgeSetupPage & { ticked: boolean };

/** Every suggested page, ticked. */
export const reviewPages = (pages: readonly KnowledgeSetupPage[]): ReviewPage[] =>
  pages.map((page) => ({ ...page, ticked: true }));

// The ids of a page's subpages at every level. Parents come first, so one pass finds them.
function subtreeOf(pages: readonly ReviewPage[], id: string): Set<string> {
  const ids = new Set([id]);
  for (const page of pages) if (page.parent !== null && ids.has(page.parent)) ids.add(page.id);
  return ids;
}

/** Unticking a page unticks its subpages (they have nowhere to sit); ticking one ticks the pages above it. */
export function withTick(pages: readonly ReviewPage[], id: string, ticked: boolean): ReviewPage[] {
  if (!ticked) {
    const off = subtreeOf(pages, id);
    return pages.map((page) => (off.has(page.id) ? { ...page, ticked: false } : page));
  }
  const byId = new Map(pages.map((page) => [page.id, page]));
  const on = new Set<string>();
  for (let at = byId.get(id); at; at = at.parent === null ? undefined : byId.get(at.parent))
    on.add(at.id);
  return pages.map((page) => (on.has(page.id) ? { ...page, ticked: true } : page));
}

/** A page renamed in place. The text is kept as typed, within a title's length; what is created is `titleOf`. */
export const withTitle = (pages: readonly ReviewPage[], id: string, title: string): ReviewPage[] =>
  pages.map((page) =>
    page.id === id ? { ...page, title: title.slice(0, SETUP_MAX_TITLE_CHARS) } : page,
  );

/** The title a page is created with: one line, capped as every page name is; never empty. */
export const titleOf = (page: Pick<ReviewPage, 'title'>): string =>
  truncateName(page.title.replace(/\s+/g, ' ').trim()) || 'Untitled Page';

/** The pages that will be created, in tree order. */
export const tickedPages = (pages: readonly ReviewPage[]): ReviewPage[] =>
  pages.filter((page) => page.ticked);

/** Why the ticked pages cannot be created, or null (describe-to-set-up.md: "a structure that would pass them says
 *  so in step 2 and creates nothing"). `existing`: the pages there now; `replacing`: the untouched first page
 *  becomes one of the new ones; `parentDepth`: how deep the page they land under sits (0 at the top level). */
export function setupLimitRefusal(
  pages: readonly ReviewPage[],
  where: { existing: number; replacing: boolean; parentDepth: number },
): PageTreeRefusal | null {
  const ticked = tickedPages(pages);
  if (where.existing - (where.replacing ? 1 : 0) + ticked.length > openPagesMax())
    return 'page_limit';
  const deepest = ticked.reduce((most, page) => Math.max(most, page.depth), 0);
  return where.parentDepth + deepest > MAX_PAGE_DEPTH ? 'depth_limit' : null;
}

/** What a refusal says in Review. */
export function setupLimitText(refusal: PageTreeRefusal): string {
  return refusal === 'depth_limit'
    ? `These pages would sit more than ${MAX_PAGE_DEPTH} levels deep, which is as deep as a knowledgebase goes. Untick the deepest pages, or add them under a page nearer the top.`
    : `${pagesHeldWords()}, and these would pass that. Untick some pages to make room.`;
}

/** What holds the pages: the owner's limit across their knowledgebases, or the one knowledgebase's bound. */
export function pagesHeldWords(): string {
  const account = openPagesBound()?.account;
  if (!account) return `A knowledgebase holds at most ${MAX_KNOWLEDGEBASE_PAGES} pages`;
  const tier = pagesTierOf(account.limit);
  const name = tier ? TIER_NAMES[tier] : 'Your plan';
  const across = account.whose === 'yours' ? 'your Knowledgebases' : 'this team’s Knowledgebases';
  return `${name} holds ${account.limit.toLocaleString('en-US')} pages across ${across}`;
}
