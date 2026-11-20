'use client';

// The knowledgebase's search (docs/specs/030-knowledgebase/search-and-ask.md "Search"): a centred dialog, results as
// you type (one request at a time, the last aborted), page titles first and then passages, each with its page, where
// the page is, its verified state and the matching lines with the matched words marked. Up, Down and Enter choose;
// Enter opens the page at the passage. A knowledgebase kept Offline is searched in the browser, behind the same
// dialog. Every role searches.
import { useEffect, useId, useRef, useState } from 'react';
import type { KnowledgeSearchResult } from '@liveknowledge/api-schema';
import { pageAncestors } from '@liveknowledge/document';
import { Dialog, NoMatches } from '@liveknowledge/ui';
import { trustMark } from '@/lib/knowledge/page-trust';
import {
  createSearchRunner,
  markedParts,
  searchFailureText,
  type SearchOutcome,
  type SearchRunner,
} from '@/lib/knowledge/knowledge-search';
import { knowledgeFailureText } from '@/lib/knowledge/knowledge-words';
import { SearchIcon } from './knowledge-icons';
import { TrustBadge } from './TrustBadge';

const MARK =
  'rounded-sm bg-brand-100 px-0.5 text-brand-900 dark:bg-brand-500/30 dark:text-brand-100';

/** Text with its matched words marked: drawn as text and `<mark>`, never as HTML. */
export function Marked({ text }: { text: string }) {
  return (
    <>
      {markedParts(text).map((part, i) =>
        part.marked ? (
          <mark key={i} className={MARK}>
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

export type SearchDialogProps = {
  onClose: () => void;
  // The search itself: the room's index, or the browser's for a knowledgebase kept Offline.
  search: (query: string, signal: AbortSignal) => Promise<KnowledgeSearchResult[]>;
  // The pages, for each result's place in the tree.
  pages: readonly { id: string; name: string; parent?: string | undefined }[];
  onOpen: (result: KnowledgeSearchResult) => void;
  debounceMs?: number;
};

export function SearchDialog({ onClose, search, pages, onOpen, debounceMs }: SearchDialogProps) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<SearchOutcome>({ status: 'idle' });
  // What is listed: the last results, kept while the next search is on its way so the list does not blink.
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  const [index, setIndex] = useState(0);
  const latest = useRef(search);
  useEffect(() => {
    latest.current = search;
  });
  // One runner for the dialog's life: made once it is open, stopped (its request aborted) when it closes.
  const runner = useRef<SearchRunner | null>(null);
  useEffect(() => {
    const made = createSearchRunner(
      (q, signal) => latest.current(q, signal),
      (next) => {
        setOutcome(next);
        if (next.status === 'done') {
          setResults(next.results);
          setIndex(0);
        } else if (next.status !== 'searching') setResults([]);
      },
      debounceMs,
    );
    runner.current = made;
    return () => made.stop();
  }, [debounceMs]);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.querySelector(`[data-result-index="${index}"]`)?.scrollIntoView?.({
      block: 'nearest',
    });
  }, [index]);
  const choose = (result: KnowledgeSearchResult | undefined) => {
    if (!result) return;
    onClose();
    onOpen(result);
  };
  const where = (result: KnowledgeSearchResult) =>
    [
      ...pageAncestors(pages, result.tab).map((p) => p.name || 'Untitled Page'),
      ...(result.isTitle ? [] : result.headings),
    ].join(' / ');
  const failure =
    outcome.status === 'failed'
      ? searchFailureText(outcome.error, (err) => knowledgeFailureText(err, 'search'))
      : null;
  const optionId = (i: number) => `${listId}-option-${i}`;
  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Search This Knowledgebase"
      size="xl"
      className="!p-0"
      initialFocus="first"
    >
      <div data-knowledge-search="" className="flex h-[min(70dvh,560px)] flex-col">
        <label className="flex shrink-0 items-center gap-2.5 border-b border-slate-200 px-4 dark:border-slate-800">
          <SearchIcon className="shrink-0 text-slate-500 dark:text-slate-400" />
          <span className="sr-only">Search This Knowledgebase</span>
          <input
            type="text"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[index] ? optionId(index) : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder="Search This Knowledgebase"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              runner.current?.search(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (results.length === 0) return;
                const step = e.key === 'ArrowDown' ? 1 : -1;
                setIndex((at) => (at + step + results.length) % results.length);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                choose(results[index]);
              }
            }}
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
          />
        </label>
        <div
          ref={list}
          id={listId}
          role="listbox"
          aria-label="Results"
          aria-busy={outcome.status === 'searching'}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
        >
          {failure ? (
            <p
              role="alert"
              className="px-3 py-6 text-center text-sm text-slate-700 dark:text-slate-200"
            >
              {failure}
            </p>
          ) : outcome.status === 'done' && results.length === 0 ? (
            <NoMatches things="pages" query={outcome.query} />
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              {outcome.status === 'searching'
                ? 'Searching…'
                : 'Search page titles and what is written on them.'}
            </p>
          ) : (
            results.map((result, i) => {
              const mark = trustMark(result.trust);
              const place = where(result);
              return (
                <button
                  key={result.id}
                  id={optionId(i)}
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  data-result-index={i}
                  onPointerMove={() => setIndex(i)}
                  onClick={() => choose(result)}
                  className={`flex w-full cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2 text-left motion-safe:transition-colors motion-safe:duration-micro phone:min-h-11 ${
                    i === index
                      ? 'bg-brand-50 dark:bg-brand-500/15'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <Marked text={result.titleMarked || result.title || 'Untitled Page'} />
                    </span>
                    {mark ? <TrustBadge mark={mark} compact /> : null}
                  </span>
                  {place ? (
                    <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {place}
                    </span>
                  ) : null}
                  {result.isTitle || !result.snippet ? null : (
                    <span className="line-clamp-2 text-[13px] leading-5 text-slate-600 dark:text-slate-300">
                      <Marked text={result.snippet} />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </Dialog>
  );
}
