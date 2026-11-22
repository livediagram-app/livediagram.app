'use client';

// The hero field's search (docs/specs/030-knowledgebase/knowledgebase-home.md "Hero"): the words are searched in
// every knowledgebase Home shows (twelve at most), each through its own search route, all at once. New words abort
// the requests of the words before. The lists are merged by rank (home-data.ts `mergeSearchResults`).
import { useEffect, useState } from 'react';
import { SEARCH_MAX_QUERY_CHARS } from '@liveknowledge/knowledge';
import { apiSearchKnowledge } from '@/lib/api/knowledge';
import { SEARCH_DEBOUNCE_MS } from '@/lib/knowledge/knowledge-search';
import {
  mergeSearchResults,
  type HomeKnowledgebase,
  type HomeSearchResult,
} from '@/lib/knowledge-home/home-data';

/** Words shorter than this search nothing. */
export const HOME_SEARCH_MIN_CHARS = 2;

export type HomeSearch =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'found'; query: string; results: HomeSearchResult[] }
  // Every knowledgebase's search failed.
  | { status: 'failed'; query: string };

const IDLE: HomeSearch = { status: 'idle' };
const SEARCHING: HomeSearch = { status: 'searching' };

export function useHomeSearch(
  ownerId: string | null,
  knowledgebases: readonly HomeKnowledgebase[],
  words: string,
): HomeSearch {
  // What the last search that finished found, and the words it was for.
  const [answered, setAnswered] = useState<Extract<HomeSearch, { query: string }> | null>(null);
  const query = words.trim().slice(0, SEARCH_MAX_QUERY_CHARS);
  const searchable =
    !!ownerId && knowledgebases.length > 0 && query.length >= HOME_SEARCH_MIN_CHARS;
  useEffect(() => {
    if (!searchable || !ownerId) return;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      const who = { ownerId, shareCode: null };
      void Promise.allSettled(
        knowledgebases.map(async (knowledgebase) => ({
          knowledgebase,
          results: await apiSearchKnowledge(who, knowledgebase.id, query, abort.signal),
        })),
      ).then((settled) => {
        if (abort.signal.aborted) return;
        const found = settled.flatMap((one) => (one.status === 'fulfilled' ? [one.value] : []));
        setAnswered(
          found.length === 0
            ? { status: 'failed', query }
            : { status: 'found', query, results: mergeSearchResults(found) },
        );
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [searchable, ownerId, knowledgebases, query]);
  if (!searchable) return IDLE;
  if (answered?.query === query) return answered;
  // While the next words are searched the last results stay, so the list does not blink between keys.
  return answered?.status === 'found' ? answered : SEARCHING;
}
