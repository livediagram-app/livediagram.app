'use client';

// The Knowledgebase Home's hero (docs/specs/030-knowledgebase/knowledgebase-home.md "Hero"): the question, one field
// that searches every knowledgebase as you type and asks the one in its scope chip, up to three of the person's own
// recent questions, and the illustration. Two columns that stack on a phone.
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button, CompactEmptyState, NoMatches, Select } from '@liveknowledge/ui';
import { SEARCH_MAX_QUERY_CHARS } from '@liveknowledge/knowledge';
import { TrustBadge } from '@/components/knowledge/TrustBadge';
import { markedParts } from '@/lib/knowledge/knowledge-search';
import { trustMark } from '@/lib/knowledge/page-trust';
import type { HomeKnowledgebase } from '@/lib/knowledge-home/home-data';
import { pageHref } from '@/lib/knowledge-home/home-links';
import { handArrival } from '@/lib/knowledge-home/arrival-handoff';
import { AskIcon, PageIcon, SearchIcon } from './home-icons';
import { HomeIllustration } from './HomeIllustration';
import type { HomeSearch } from './useHomeSearch';

export type HomeExample = { question: string; documentId: string };

function Marked({ text }: { text: string }) {
  return (
    <>
      {markedParts(text).map((part, at) =>
        part.marked ? (
          <mark
            key={at}
            className="rounded-[3px] bg-brand-100 px-0.5 text-inherit dark:bg-brand-500/25"
          >
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

function Results({ search, onClear }: { search: HomeSearch; onClear: () => void }) {
  if (search.status === 'idle') return null;
  return (
    <div
      data-home-results=""
      className="absolute inset-x-0 top-full z-[var(--z-toolbar)] mt-2 max-h-[22rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50"
    >
      {search.status === 'searching' ? (
        <p role="status" className="px-3 py-3 text-sm text-slate-600 dark:text-slate-400">
          Searching your knowledgebases…
        </p>
      ) : search.status === 'failed' ? (
        <CompactEmptyState
          icon={<SearchIcon />}
          title="Search Is Not Answering"
          description="Check your connection and type again."
          role="status"
        />
      ) : search.results.length === 0 ? (
        <NoMatches things="pages" query={search.query} icon={<SearchIcon />} onClear={onClear} />
      ) : (
        <ul aria-label="Search Results" className="flex flex-col">
          {search.results.map((result) => {
            const mark = trustMark(result.trust);
            return (
              <li key={`${result.documentId}:${result.id}`}>
                <a
                  href={pageHref(result.documentId, result.tab)}
                  data-home-result=""
                  // A passage's result opens its page at the passage (a title's opens the page at its top). Handed
                  // over as the link is followed; a click that opens another tab carries nothing, and the page
                  // opens at its top there.
                  onClick={() => {
                    if (!result.isTitle && result.firstBlock)
                      handArrival({
                        kind: 'passage',
                        documentId: result.documentId,
                        tab: result.tab,
                        block: result.firstBlock,
                      });
                  }}
                  className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 dark:hover:bg-slate-800"
                >
                  <span aria-hidden className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400">
                    <PageIcon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        <Marked text={result.titleMarked || result.title} />
                      </span>
                      {mark ? <TrustBadge mark={mark} compact /> : null}
                    </span>
                    {result.isTitle ? null : (
                      <span className="mt-0.5 line-clamp-2 block break-words text-[13px] leading-5 text-slate-700 dark:text-slate-300">
                        <Marked text={result.snippet} />
                      </span>
                    )}
                    <span className="mt-0.5 block truncate text-xs text-slate-600 dark:text-slate-400">
                      {[result.knowledgebase, ...result.headings].join(' › ')}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function HomeHero({
  firstName,
  knowledgebases,
  ready,
  scope,
  onScope,
  words,
  onWords,
  search,
  examples,
  onAsk,
}: {
  firstName: string;
  knowledgebases: readonly HomeKnowledgebase[];
  // The list has been read: the field knows whether there is anything to search or ask.
  ready: boolean;
  // The knowledgebase Ask goes to.
  scope: string | null;
  onScope: (documentId: string) => void;
  words: string;
  onWords: (words: string) => void;
  search: HomeSearch;
  examples: readonly HomeExample[];
  onAsk: (documentId: string, question: string) => void;
}) {
  const fieldId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const none = ready && knowledgebases.length === 0;
  const canAsk = scope !== null && words.trim() !== '';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canAsk && scope) onAsk(scope, words.trim());
  };
  // Down from the field goes into the results; Escape closes them.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') setOpen(false);
    if (event.key === 'ArrowDown') {
      const first = box.current?.querySelector<HTMLElement>('[data-home-result]');
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <section
      aria-labelledby={`${fieldId}-heading`}
      className="grid items-center gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-12 lg:py-14"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">
          Your Team&apos;s Knowledge
        </p>
        <h1
          id={`${fieldId}-heading`}
          className="mt-3 text-balance text-[34px] font-semibold leading-[1.08] tracking-[-0.025em] text-slate-900 dark:text-white sm:text-[46px]"
        >
          What do you need to know{firstName ? `, ${firstName}` : ''}?
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
          Search every page your team has written, or ask a question and get an answer that says
          which pages it came from and who verified them.
        </p>

        <form onSubmit={submit} className="mt-7 max-w-xl" role="search">
          <div
            ref={box}
            className="relative"
            onFocus={() => setOpen(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
            }}
          >
            <div className="flex min-h-14 items-center gap-2 rounded-2xl border border-slate-300 bg-white py-2 pl-4 pr-2 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25 dark:border-slate-700 dark:bg-slate-900">
              <span aria-hidden className="shrink-0 text-slate-500 dark:text-slate-400">
                <SearchIcon />
              </span>
              <label htmlFor={fieldId} className="sr-only">
                Search or ask
              </label>
              <input
                id={fieldId}
                type="text"
                inputMode="search"
                enterKeyHint="go"
                autoComplete="off"
                value={words}
                maxLength={SEARCH_MAX_QUERY_CHARS}
                disabled={none}
                placeholder={
                  none ? 'Make a knowledgebase to search it' : 'Search, or ask a question'
                }
                onChange={(event) => {
                  onWords(event.target.value);
                  setOpen(true);
                }}
                onKeyDown={onKeyDown}
                className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-slate-900 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed dark:text-white dark:placeholder:text-slate-400"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!canAsk}
                className="shrink-0"
              >
                <AskIcon />
                Ask
              </Button>
            </div>
            {open ? <Results search={search} onClear={() => onWords('')} /> : null}
          </div>
          {/* The scope chip's row keeps its height whether the list is in or not, so nothing below it moves. */}
          <div className="mt-2.5 flex min-h-8 flex-wrap items-center gap-2 text-[13px] text-slate-600 dark:text-slate-400">
            {scope !== null && knowledgebases.length > 0 ? (
              <>
                <span id={`${fieldId}-scope`}>Ask goes to</span>
                <Select
                  size="sm"
                  aria-labelledby={`${fieldId}-scope`}
                  value={scope}
                  onChange={(event) => onScope(event.target.value)}
                  className="max-w-[16rem] rounded-full"
                  selectClassName="max-w-full truncate rounded-full !py-1 !pl-3 !text-[13px] phone:min-h-11"
                >
                  {knowledgebases.map((knowledgebase) => (
                    <option key={knowledgebase.id} value={knowledgebase.id}>
                      {knowledgebase.name}
                    </option>
                  ))}
                </Select>
                <span>Search looks in all of them.</span>
              </>
            ) : null}
          </div>
        </form>

        {examples.length > 0 ? (
          <div className="mt-4 max-w-xl" data-home-examples="">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Ask Again
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {examples.map((example) => (
                <li
                  key={`${example.documentId}:${example.question}`}
                  className="min-w-0 max-w-full"
                >
                  <button
                    type="button"
                    onClick={() => onAsk(example.documentId, example.question)}
                    className="max-w-full cursor-pointer truncate rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-slate-700 motion-safe:transition-colors motion-safe:duration-micro hover:border-brand-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 phone:min-h-11 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-400 dark:hover:text-white"
                  >
                    {example.question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {/* The art's box is its own shape before the SVG paints, so the columns never move. */}
      <HomeIllustration className="mx-auto aspect-[7/5] w-full max-w-[34rem]" />
    </section>
  );
}
