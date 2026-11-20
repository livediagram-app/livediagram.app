// Search in the editor (docs/specs/030-knowledgebase/search-and-ask.md "Search"), the parts with no React:
// - the server's marked snippets read as text and marks, never as HTML;
// - one search at a time: debounced, the last request aborted before the next starts;
// - the same search in the browser for a knowledgebase kept Offline, over the pages this editor holds.
import {
  MATCH_END,
  MATCH_START,
  SEARCH_MAX_QUERY_CHARS,
  SEARCH_MAX_RESULTS,
  pagePassages,
  searchTerms,
} from '@liveknowledge/knowledge';
import type { KnowledgeSearchResult } from '@liveknowledge/api-schema';
import type { ArticleBlock } from '@liveknowledge/document';
import { pageTrust } from './page-trust';

/** How long the typing rests before a search is sent (ms). */
export const SEARCH_DEBOUNCE_MS = 150;

export type MarkedPart = { text: string; marked: boolean };

/** A snippet as the pieces to draw: the words between U+0002 and U+0003 are the matched ones. Whatever else the
 *  text holds is text: nothing in it is read as markup. */
export function markedParts(snippet: string): MarkedPart[] {
  const parts: MarkedPart[] = [];
  let marked = false;
  let text = '';
  const push = () => {
    if (text) parts.push({ text, marked });
    text = '';
  };
  for (const char of snippet) {
    if (char === MATCH_START || char === MATCH_END) {
      push();
      marked = char === MATCH_START;
    } else text += char;
  }
  push();
  return parts;
}

export type SearchOutcome =
  | { status: 'idle' }
  | { status: 'searching'; query: string }
  | { status: 'done'; query: string; results: KnowledgeSearchResult[] }
  | { status: 'failed'; query: string; error: unknown };

export type SearchRunner = {
  /** Search for what is typed now: after the debounce, with whatever was in flight aborted. */
  search: (query: string) => void;
  /** Stop: nothing pending, nothing in flight, nothing told. */
  stop: () => void;
};

/** One search at a time. `run` is handed a signal that aborts when a newer query replaces this one. */
export function createSearchRunner(
  run: (query: string, signal: AbortSignal) => Promise<KnowledgeSearchResult[]>,
  tell: (outcome: SearchOutcome) => void,
  debounceMs = SEARCH_DEBOUNCE_MS,
): SearchRunner {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flight: AbortController | null = null;
  const stop = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    flight?.abort();
    flight = null;
  };
  return {
    stop,
    search(raw) {
      stop();
      const query = raw.trim();
      if (!query) return tell({ status: 'idle' });
      // Past the limit nothing is sent: the dialog says so in words (the route would refuse it the same way).
      if (query.length > SEARCH_MAX_QUERY_CHARS)
        return tell({ status: 'failed', query, error: new SearchTooLongError() });
      tell({ status: 'searching', query });
      timer = setTimeout(() => {
        timer = null;
        const controller = new AbortController();
        flight = controller;
        run(query, controller.signal).then(
          (results) => {
            if (flight !== controller) return;
            flight = null;
            tell({ status: 'done', query, results });
          },
          (error: unknown) => {
            if (flight !== controller) return;
            flight = null;
            tell({ status: 'failed', query, error });
          },
        );
      }, debounceMs);
    },
  };
}

export class SearchTooLongError extends Error {
  constructor() {
    super(`A search is at most ${SEARCH_MAX_QUERY_CHARS} characters.`);
    this.name = 'SearchTooLongError';
  }
}

/** What a failed search says. */
export function searchFailureText(error: unknown, words: (err: unknown) => string): string {
  return error instanceof SearchTooLongError ? error.message : words(error);
}

type SearchPage = {
  id: string;
  name: string;
  knowledge?: unknown;
  articles?: Record<string, { blocks: readonly ArticleBlock[] }>;
};

const escapeRe = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** How much of a passage a result shows round its first match. */
const SNIPPET_CHARS = 160;

// The text with every word that starts with a term marked, as the server marks its own.
function marked(text: string, terms: readonly string[]): string {
  if (terms.length === 0) return text;
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${terms.map(escapeRe).join('|')})[\\p{L}\\p{N}]*`,
    'giu',
  );
  return text.replace(pattern, (word) => `${MATCH_START}${word}${MATCH_END}`);
}

function snippetOf(text: string, terms: readonly string[]): string {
  const lower = text.toLowerCase();
  const first = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0));
  const from = Number.isFinite(first) ? Math.max(0, first - 40) : 0;
  const cut = text.slice(from, from + SNIPPET_CHARS);
  return marked(
    `${from > 0 ? '…' : ''}${cut}${from + SNIPPET_CHARS < text.length ? '…' : ''}`,
    terms,
  );
}

/**
 * Search the pages this editor holds, for a knowledgebase kept Offline: every word must be in the title or in one
 * passage (the last word may be the start of one, as you type), titles first, then passages, 20 at most. The same
 * passages the room indexes (`pagePassages`), the same result shape, no ranking beyond that order.
 */
export function searchLoadedPages(
  pages: readonly SearchPage[],
  query: string,
  now: number,
): KnowledgeSearchResult[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  const has = (text: string) => {
    const lower = text.toLowerCase();
    return terms.every((term) => lower.includes(term));
  };
  const titles: KnowledgeSearchResult[] = [];
  const passages: KnowledgeSearchResult[] = [];
  for (const page of pages) {
    const trust = pageTrust(page.knowledge, now);
    const base = {
      tab: page.id,
      title: page.name,
      trust: trust.state,
      ...(trust.fields.verifiedAt === undefined ? {} : { verifiedAt: trust.fields.verifiedAt }),
    };
    if (has(page.name))
      titles.push({
        ...base,
        id: `title:${page.id}`,
        isTitle: true,
        titleMarked: marked(page.name, terms),
        headings: [],
        snippet: '',
        firstBlock: '',
        lastBlock: '',
      });
    if (titles.length + passages.length >= SEARCH_MAX_RESULTS * 2) continue;
    const flow = Object.values(page.articles ?? {})[0];
    if (!flow) continue;
    for (const passage of pagePassages(page.id, { blocks: flow.blocks as ArticleBlock[] })) {
      if (!has(passage.text)) continue;
      passages.push({
        ...base,
        id: passage.id,
        isTitle: false,
        titleMarked: page.name,
        headings: passage.headings,
        snippet: snippetOf(passage.text, terms),
        firstBlock: passage.firstBlock,
        lastBlock: passage.lastBlock,
      });
    }
  }
  return [...titles, ...passages].slice(0, SEARCH_MAX_RESULTS);
}
