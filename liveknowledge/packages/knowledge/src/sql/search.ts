// Search over a knowledgebase's passages (docs/specs/030-knowledgebase/search-and-ask.md "Search"): the person's
// words made into a safe FTS5 expression, and the query that ranks page titles first, verified pages before the
// rest, then by bm25.
import type { TrustStateName } from '../trust';
import type { SqlStatement, SqlValue } from './statement';

export const SEARCH_MAX_QUERY_CHARS = 200;
export const SEARCH_MAX_RESULTS = 20;
/** No more words than this reach the index from one query. */
export const SEARCH_MAX_TERMS = 12;
/** The marks around a matched word in a result's `snippet` and `titleMarked`: control characters, so no writing
 *  can hold them and the client marks the words without parsing HTML. */
export const MATCH_START = '\u0002';
export const MATCH_END = '\u0003';

const DAY_MS = 86_400_000;
// A title match outweighs a match in the text.
const TITLE_WEIGHT = 10;
const TRUST_OF_RANK: readonly TrustStateName[] = ['never-verified', 'review-due', 'verified'];

/** The words of a query, as the index is asked for them: letters and digits only, lowercased, at most
 *  SEARCH_MAX_TERMS from the first SEARCH_MAX_QUERY_CHARS characters. */
export function searchTerms(query: string): string[] {
  const words =
    query
      .slice(0, SEARCH_MAX_QUERY_CHARS)
      .normalize('NFKC')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.slice(0, SEARCH_MAX_TERMS);
}

/** A safe FTS5 expression for `terms`: each a quoted string, so nothing a person types is read as an operator, a
 *  column filter or a NEAR group. `all` needs every word (the last as a prefix, for search as you type); `any`
 *  needs one, for a question's words. Undefined when there are no words. */
export function ftsExpression(terms: readonly string[], mode: 'all' | 'any'): string | undefined {
  // A term holds letters and digits only (searchTerms), but a caller's own list is quoted safely too.
  const quoted = terms
    .slice(0, SEARCH_MAX_TERMS)
    .map((t) => t.replace(/"/g, '').trim())
    .filter(Boolean)
    .map((t) => `"${t}"`);
  if (!quoted.length) return undefined;
  if (mode === 'any') return quoted.join(' OR ');
  return `${quoted.join(' ')}*`;
}

export type SearchOptions = {
  /** Now (epoch ms): a page is verified until its review is due. */
  now: number;
  /** At most SEARCH_MAX_RESULTS, which is also the default. */
  limit?: number;
  /** `all` (the default) for the search field, `any` for a question's words. */
  mode?: 'all' | 'any';
  /** Leave title rows out: Ask and the conflict check read passages only. */
  passagesOnly?: boolean;
  /** Leave one page out: the conflict check looks on other pages. */
  exceptTab?: string;
};

/** A row of `searchPassages`, as SQLite answers it. */
export type SearchRow = {
  id: string;
  tab: string;
  ordinal: number;
  headings: string;
  text: string;
  textHash: string;
  firstBlock: string;
  lastBlock: string;
  title: string;
  titleMarked: string;
  snippet: string;
  verifiedAt: number | null;
  trust: number;
  rank: number;
};

export type FoundPassage = {
  id: string;
  tab: string;
  /** Whether this is the page's title row rather than a passage of its writing. */
  isTitle: boolean;
  /** The page's title. */
  title: string;
  /** The title with the matched words marked (MATCH_START, MATCH_END). */
  titleMarked: string;
  headings: string[];
  text: string;
  textHash: string;
  /** The matching lines with the words marked. */
  snippet: string;
  firstBlock: string;
  lastBlock: string;
  trust: TrustStateName;
  verifiedAt?: number;
  /** bm25: lower is a better match. */
  rank: number;
};

/** The search statement for words already made safe, or undefined when there are none to look for. */
export function searchByTerms(
  terms: readonly string[],
  options: SearchOptions,
): SqlStatement | undefined {
  const match = ftsExpression(terms, options.mode ?? 'all');
  if (!match) return undefined;
  const limit = Math.min(
    SEARCH_MAX_RESULTS,
    Math.max(1, Math.floor(options.limit ?? SEARCH_MAX_RESULTS)),
  );
  const where = ['passages_fts MATCH ?'];
  const params: SqlValue[] = [options.now, match];
  if (options.passagesOnly) where.push('p.ordinal >= 0');
  if (options.exceptTab !== undefined) {
    where.push('p.tab <> ?');
    params.push(options.exceptTab);
  }
  params.push(limit);
  return {
    sql: `SELECT p.id AS id, p.tab AS tab, p.ordinal AS ordinal, p.headings AS headings, p.text AS text,
        p.text_hash AS textHash, p.first_block AS firstBlock, p.last_block AS lastBlock,
        COALESCE(t.title, '') AS title, t.verified_at AS verifiedAt,
        CASE
          WHEN t.verified_at IS NULL THEN 0
          WHEN t.review_days IS NOT NULL AND t.verified_at + t.review_days * ${DAY_MS} <= ? THEN 1
          ELSE 2
        END AS trust,
        highlight(passages_fts, 0, char(2), char(3)) AS titleMarked,
        snippet(passages_fts, 1, char(2), char(3), '…', 24) AS snippet,
        bm25(passages_fts, ${TITLE_WEIGHT}.0, 1.0) AS rank
      FROM passages_fts
      JOIN passages p ON p.rowid = passages_fts.rowid
      LEFT JOIN page_trust t ON t.tab = p.tab
      WHERE ${where.join(' AND ')}
      ORDER BY (p.ordinal < 0) DESC, (trust = 2) DESC, rank, p.tab, p.ordinal
      LIMIT ?`,
    params,
  };
}

/** The search statement for what a person typed, or undefined when it holds no word to look for. */
export const searchPassages = (query: string, options: SearchOptions): SqlStatement | undefined =>
  searchByTerms(searchTerms(query), options);

const parseHeadings = (json: string): string[] => {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((h): h is string => typeof h === 'string') : [];
  } catch {
    return [];
  }
};

/** A search row as the rest of the package reads it. */
export function foundPassage(row: SearchRow): FoundPassage {
  const isTitle = row.ordinal < 0;
  return {
    id: row.id,
    tab: row.tab,
    isTitle,
    title: row.title,
    titleMarked: isTitle ? row.titleMarked : row.title,
    headings: parseHeadings(row.headings),
    text: row.text,
    textHash: row.textHash,
    snippet: row.snippet,
    firstBlock: row.firstBlock,
    lastBlock: row.lastBlock,
    trust: TRUST_OF_RANK[row.trust] ?? 'never-verified',
    ...(row.verifiedAt === null ? {} : { verifiedAt: row.verifiedAt }),
    rank: row.rank,
  };
}
