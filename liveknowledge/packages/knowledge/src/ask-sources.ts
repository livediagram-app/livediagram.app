// Answering from sources as well as pages (docs/specs/030-knowledgebase/search-and-ask.md "Sources"): the search over
// the source chunks a question makes, a found chunk as a passage, and the passages chosen with pages first.
import { ASK_MAX_PASSAGES, ASK_MAX_PASSAGE_CHARS } from './ask-limits';
import { chooseAskPassages, type AskPassage } from './ask-passages';
import { contentWords } from './questions';
import { searchSourceChunks, type SourceSearchRow } from './sql/source-index';
import { searchTerms, type FoundPassage } from './sql/search';
import type { SqlStatement } from './sql/statement';

/** Source chunks one question sends at most, and their characters: pages keep the rest of the 24,000. */
export const ASK_MAX_SOURCE_PASSAGES = 6;
export const ASK_MAX_SOURCE_CHARS = 8_000;
/** Chunks a question's search finds before the reader's access is checked: room for some to be left out. */
export const ASK_SOURCE_CANDIDATES = 24;
/** A search's source hits (search_pages, the search panel) at most. */
export const SEARCH_MAX_SOURCE_HITS = 8;

/** The search for a question's source chunks: any of its words that carry meaning. Undefined with no words. */
export const askSourceSearch = (question: string): SqlStatement | undefined =>
  searchSourceChunks(contentWords(question), { mode: 'any', limit: ASK_SOURCE_CANDIDATES });

/** The search for what a person or an agent typed (all words, the last as a prefix), as the pages' search reads it. */
export const sourceSearch = (
  query: string,
  limit = SEARCH_MAX_SOURCE_HITS,
): SqlStatement | undefined => searchSourceChunks(searchTerms(query), { mode: 'all', limit });

/** A found chunk as a passage: its item's id in `tab`, its item's name as the title, the place's name as its one
 *  heading, never verified. */
export function foundSourcePassage(row: SourceSearchRow): FoundPassage {
  return {
    id: row.id,
    tab: row.itemId,
    isTitle: false,
    title: row.itemName,
    titleMarked: row.itemName,
    headings: row.title && row.title !== row.itemName ? [row.title] : [],
    text: row.text,
    textHash: '',
    snippet: row.snippet,
    firstBlock: '',
    lastBlock: '',
    trust: 'never-verified',
    rank: row.rank,
    source: {
      app: row.app,
      itemId: row.itemId,
      itemName: row.itemName,
      place: row.place,
      readAt: row.readAt ?? 0,
    },
  };
}

/** The passages a question sends: its pages first (chooseAskPassages), keeping room for sources when any were found,
 *  then the source chunks the reader may see, best first, within what is left, ASK_MAX_SOURCE_CHARS and
 *  ASK_MAX_SOURCE_PASSAGES. Numbered on, after the pages. */
export function chooseAskPassagesWithSources(
  pages: readonly FoundPassage[],
  sources: readonly FoundPassage[],
): AskPassage[] {
  const chosen = chooseAskPassages(
    pages,
    sources.length ? ASK_MAX_PASSAGE_CHARS - ASK_MAX_SOURCE_CHARS : ASK_MAX_PASSAGE_CHARS,
  );
  if (!sources.length) return chosen;
  let used = 0;
  for (const p of chosen) used += p.passage.text.length;
  let left = Math.min(ASK_MAX_SOURCE_CHARS, ASK_MAX_PASSAGE_CHARS - used);
  let taken = 0;
  for (const passage of [...sources].sort((a, b) => a.rank - b.rank)) {
    if (chosen.length >= ASK_MAX_PASSAGES || taken >= ASK_MAX_SOURCE_PASSAGES) break;
    if (passage.text.length > left) continue;
    chosen.push({ number: chosen.length + 1, passage });
    left -= passage.text.length;
    taken++;
  }
  return chosen;
}
