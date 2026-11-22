'use client';

// This Knowledgebase, the search panel's first group (docs/specs/030-knowledgebase/search-and-ask.md "Search"): page
// titles then passages for what is typed (the room's index, or the pages this editor holds for a knowledgebase kept
// Offline), and the pages opened most recently while the field is empty. One request at a time: a new query aborts
// the one in flight, after the same pause the dialog used. It answers on its own, so the panel's other groups never
// wait for it.
import { useEffect, useMemo, useState } from 'react';
import type { KnowledgeSearchResult } from '@liveknowledge/api-schema';
import { pageAncestors } from '@liveknowledge/document';
import {
  useEditorChrome,
  useEditorChromeStore,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import { sameTabsForBar } from '@/app/document/[id]/editor-view-bars';
import type { SearchLeadGroup, SearchLeadItem } from '@/components/panels/search-lead-group';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { apiSearchKnowledge } from '@/lib/api/knowledge';
import { goToBlock } from '@/lib/knowledge/go-to-block';
import {
  createSearchRunner,
  searchFailureText,
  searchLoadedPages,
  type SearchOutcome,
  type SearchRunner,
} from '@/lib/knowledge/knowledge-search';
import { knowledgeFailureText } from '@/lib/knowledge/knowledge-words';
import type { ReviewEvery } from '@liveknowledge/knowledge';
import { useReviewEvery } from '@/components/knowledge-settings/useReviewEvery';
import { knowledgeSettingsStore } from '@/lib/knowledge-settings/knowledge-settings-store';
import { pageTrust } from '@/lib/knowledge/page-trust';
import { readRecentPages } from '@/lib/knowledge/recent-pages';
import { track } from '@/lib/telemetry';
import { KnowledgeResultRow } from './KnowledgeResultRow';

export const THIS_KNOWLEDGEBASE = 'This Knowledgebase';
/** The one line shown when nothing in this knowledgebase matches: it was searched, and the other groups follow. */
export const NO_PAGES_MATCH = 'No Pages Match';

type Page = { id: string; name: string; parent?: string | undefined; knowledge?: unknown };

/** Where a result is: its page's ancestors, then (for a passage) the headings it sits under. */
export function resultPlace(
  pages: readonly Page[],
  result: Pick<KnowledgeSearchResult, 'tab' | 'isTitle' | 'headings'>,
): string {
  return [
    ...pageAncestors(pages, result.tab).map((p) => p.name || 'Untitled Page'),
    ...(result.isTitle ? [] : result.headings),
  ].join(' / ');
}

/** The pages opened most recently, as results: the newest first, a page that is gone left out. */
export function recentResults(
  pages: readonly Page[],
  recent: readonly string[],
  every: ReviewEvery,
  now: number,
): KnowledgeSearchResult[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  return recent.flatMap((id) => {
    const page = byId.get(id);
    if (!page) return [];
    const trust = pageTrust(page.knowledge, every, now);
    return [
      {
        id: `recent:${id}`,
        tab: id,
        title: page.name,
        titleMarked: page.name,
        isTitle: true,
        trust: trust.state,
        ...(trust.fields.verifiedAt === undefined ? {} : { verifiedAt: trust.fields.verifiedAt }),
        headings: [],
        snippet: '',
        firstBlock: '',
        lastBlock: '',
      },
    ];
  });
}

const NO_RESULTS: KnowledgeSearchResult[] = [];

// The recent pages as the panel opens: read from this browser once, with the time their trust is told at.
const recentNow = (pages: readonly Page[], documentId: string | null, every: ReviewEvery) =>
  recentResults(pages, readRecentPages(documentId), every, Date.now());

// The one runner a panel's life has: the room's index, or the pages this editor holds for a knowledgebase kept
// Offline.
function knowledgeRunner(
  editorNow: () => EditorContextValue,
  offline: boolean,
  tell: (outcome: SearchOutcome) => void,
  debounceMs: number | undefined,
): SearchRunner {
  return createSearchRunner(
    (q, signal) => {
      const editor = editorNow();
      if (!editor.documentId || offline)
        return Promise.resolve(
          searchLoadedPages(
            editor.tabs,
            q,
            knowledgeSettingsStore.reviewEveryOf(editor.documentId),
            Date.now(),
          ),
        );
      return apiSearchKnowledge(
        { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode },
        editor.documentId,
        q,
        signal,
      );
    },
    tell,
    debounceMs,
  );
}

export function useThisKnowledgebaseSearch(
  query: string,
  { enabled, debounceMs }: { enabled: boolean; debounceMs?: number },
): SearchLeadGroup | undefined {
  const chrome = useEditorChromeStore();
  const documentId = useEditorChrome((s) => s.documentId);
  const offline = useIsOfflineDocument(documentId);
  const pages = useEditorChrome((s) => s.tabs, sameTabsForBar);
  const every = useReviewEvery(documentId);
  const [outcome, setOutcome] = useState<SearchOutcome>({ status: 'idle' });
  // What is listed: the last results, kept while the next search is on its way so the group does not blink.
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  // One runner while the knowledgebase is where it is (saved, or kept Offline): a new one stops the old one's
  // request (the effect below).
  const runner = useMemo(
    () =>
      knowledgeRunner(
        chrome.get,
        offline,
        (next) => {
          setOutcome(next);
          if (next.status === 'done') setResults(next.results);
          else if (next.status !== 'searching') setResults([]);
        },
        debounceMs,
      ),
    [chrome, offline, debounceMs],
  );
  // The panel closing, or the editor going: nothing pending, the request in flight aborted.
  useEffect(() => {
    if (enabled) runner.search(query);
    else runner.stop();
  }, [enabled, query, runner]);
  useEffect(() => () => runner.stop(), [runner]);

  const typed = query.trim() !== '';
  // Read as the panel opens (and per knowledgebase), not per keystroke.
  const recent = useMemo(
    () => (enabled ? recentNow(pages, documentId, every) : NO_RESULTS),
    [enabled, pages, documentId, every],
  );
  return useMemo(() => {
    if (!enabled) return undefined;
    const shown = typed ? results : recent;
    const items: SearchLeadItem[] = shown.map((result) => ({
      id: result.id,
      content: <KnowledgeResultRow result={result} place={resultPlace(pages, result)} />,
      onSelect: () => {
        track(
          'UI',
          'Used',
          !typed ? 'SearchRecentPage' : result.isTitle ? 'SearchResultPage' : 'SearchResultPassage',
        );
        goToBlock(chrome.get, result.tab, result.isTitle ? '' : result.firstBlock);
      },
    }));
    const failed = typed && outcome.status === 'failed';
    const note = failed
      ? searchFailureText(outcome.error, (err) => knowledgeFailureText(err, 'search'))
      : items.length > 0
        ? undefined
        : !typed
          ? 'Pages you open are listed here.'
          : outcome.status === 'done'
            ? NO_PAGES_MATCH
            : 'Searching…';
    return {
      label: THIS_KNOWLEDGEBASE,
      items: failed ? [] : items,
      note,
      alert: failed,
      busy: typed && outcome.status === 'searching',
    };
  }, [enabled, typed, results, recent, pages, outcome, chrome]);
}
