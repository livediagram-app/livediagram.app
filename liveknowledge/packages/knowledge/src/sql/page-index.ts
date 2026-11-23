// What the room writes when a page's writing is saved or the page is deleted
// (docs/specs/030-knowledgebase/search-and-ask.md "Search", links-and-embeds.md "Backlinks"): the page's passages,
// their words in the search index, its links and its trust row, replaced together. The room runs the statements in
// order inside one transaction (`ctx.storage.transactionSync`), so search never sees half a page.
import type { Passage } from '../passages';
import { MAX_PAGE_LINKS } from '../page-links';
import { stableHash } from '../hash';
import { TITLE_ORDINAL } from './schema';
import { insertRows, type SqlStatement, type SqlValue } from './statement';

/** A title is indexed up to here; a tab's name is far shorter. */
export const MAX_INDEXED_TITLE_CHARS = 200;

/** When the review comes due is not stored: it is `verifiedAt` plus the knowledgebase's Review Period, worked out
 *  by each read, so a change of period rewrites no row. */
export type PageTrustRow = {
  /** When the page was verified (epoch ms); absent is never. */
  verifiedAt?: number;
};

export type PageIndex = {
  tab: string;
  title: string;
  passages: readonly Passage[];
  /** The pages this page's writing links to (page-links.ts). */
  links: readonly string[];
  trust: PageTrustRow;
};

const PASSAGE_COLUMNS = [
  'id',
  'tab',
  'ordinal',
  'headings',
  'title',
  'text',
  'text_hash',
  'first_block',
  'last_block',
] as const;

// Out of the search index first, while `passages` still holds the words an external-content index must be handed
// to forget them.
const forgetWords = (tab: string): SqlStatement => ({
  sql: `INSERT INTO passages_fts (passages_fts, rowid, title, text)
    SELECT 'delete', rowid, title, text FROM passages WHERE tab = ?`,
  params: [tab],
});

/** Closes every conflict one of whose passages is gone or reads differently now
 *  (docs/specs/030-knowledgebase/insights.md "Pages that disagree": a conflict closes by itself when either
 *  passage changes). A dismissed pair goes too: its passages are not the ones that were dismissed. */
export const closeChangedConflicts = (tab: string): SqlStatement => ({
  sql: `DELETE FROM conflicts WHERE (a_tab = ? OR b_tab = ?) AND (
    NOT EXISTS (SELECT 1 FROM passages p WHERE p.id = conflicts.a_passage AND p.text_hash = conflicts.a_hash)
    OR NOT EXISTS (SELECT 1 FROM passages p WHERE p.id = conflicts.b_passage AND p.text_hash = conflicts.b_hash)
  )`,
  params: [tab, tab],
});

/** The page's title and verification, as search reads them. Also what Verify writes. */
export const putPageTrust = (tab: string, title: string, trust: PageTrustRow): SqlStatement => ({
  sql: `INSERT INTO page_trust (tab, title, verified_at) VALUES (?, ?, ?)
    ON CONFLICT (tab) DO UPDATE SET title = excluded.title, verified_at = excluded.verified_at`,
  params: [tab, title.slice(0, MAX_INDEXED_TITLE_CHARS), trust.verifiedAt ?? null],
});

/**
 * How many pages would be Review Due at `now` under a Review Period of `days` (the dialog's count before a
 * shorter period is applied; verification.md "The Review Period"): one read of `page_trust_verified`, a row a
 * verified page, 500 pages at most. Undefined days (Never) makes nothing due: the caller answers 0 without asking.
 */
export const countReviewDue = (days: number, now: number): SqlStatement => ({
  sql: `SELECT COUNT(*) AS due FROM page_trust WHERE verified_at IS NOT NULL AND verified_at <= ?`,
  params: [now - days * 86_400_000],
});

/** Replaces everything the index holds of one page. Run in order, in one transaction. */
export function replacePageIndex(page: PageIndex): SqlStatement[] {
  const { tab } = page;
  const title = page.title.slice(0, MAX_INDEXED_TITLE_CHARS);
  const rows: SqlValue[][] = [
    [stableHash(tab, 'title'), tab, TITLE_ORDINAL, '[]', title, '', '', '', ''],
    ...page.passages.map((p) => [
      p.id,
      tab,
      p.ordinal,
      JSON.stringify(p.headings),
      '',
      p.text,
      p.textHash,
      p.firstBlock,
      p.lastBlock,
    ]),
  ];
  const links = [...new Set(page.links)].filter((to) => to !== tab).slice(0, MAX_PAGE_LINKS);
  return [
    forgetWords(tab),
    { sql: 'DELETE FROM passages WHERE tab = ?', params: [tab] },
    ...insertRows('INSERT INTO', 'passages', PASSAGE_COLUMNS, rows),
    {
      sql: `INSERT INTO passages_fts (rowid, title, text) SELECT rowid, title, text FROM passages WHERE tab = ?`,
      params: [tab],
    },
    { sql: 'DELETE FROM page_links WHERE from_tab = ?', params: [tab] },
    ...insertRows(
      'INSERT OR IGNORE INTO',
      'page_links',
      ['from_tab', 'to_tab'],
      links.map((to) => [tab, to]),
    ),
    putPageTrust(tab, title, page.trust),
    closeChangedConflicts(tab),
  ];
}

/** Removes a deleted page from the index. Links other pages make to it stay: they are still in those pages'
 *  writing, and show as "Deleted Page". Its reads stay until they age out. */
export function deletePageIndex(tab: string): SqlStatement[] {
  return [
    forgetWords(tab),
    { sql: 'DELETE FROM passages WHERE tab = ?', params: [tab] },
    { sql: 'DELETE FROM page_links WHERE from_tab = ?', params: [tab] },
    { sql: 'DELETE FROM page_trust WHERE tab = ?', params: [tab] },
    { sql: 'DELETE FROM conflict_checks WHERE tab = ?', params: [tab] },
    closeChangedConflicts(tab),
  ];
}

/** The pages whose writing links to `tab` (page-links.ts `backlinks` puts them in tree order). */
export const backlinkRows = (tab: string): SqlStatement => ({
  sql: 'SELECT from_tab AS fromTab FROM page_links WHERE to_tab = ?',
  params: [tab],
});
