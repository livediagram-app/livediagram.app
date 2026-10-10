'use client';

import { lucideSearch } from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';
import { useDeferredValue, useMemo, useState } from 'react';

import { FaqItem } from '@/components/faq/FaqItem';
import { PageHero } from '@/components/PageHero';
import { FAQ_CATEGORIES } from '@/lib/faq-content';
import { filterFaq } from '@/lib/faq-filter';

const SearchIcon = lucideGlyph(lucideSearch, 18);

const TOTAL = FAQ_CATEGORIES.reduce((n, c) => n + c.items.length, 0);

// The /faq page body (docs/specs/019-marketing/marketing-site.md "Content pages (FAQ)"): a search box that narrows
// every category as you type, a sticky category index beside the questions on wide screens, and each question as
// a native <details> card, so the answers are in the static HTML for crawlers and open without any script.
export function FaqBrowser({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const searching = deferred.trim() !== '';
  const categories = useMemo(() => filterFaq(FAQ_CATEGORIES, deferred), [deferred]);
  const matches = categories.reduce((n, c) => n + c.items.length, 0);

  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} lede={lede}>
        <div className="relative mx-auto mt-8 max-w-xl">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${TOTAL} questions`}
            aria-label="Search the questions"
            className="w-full rounded-full border border-slate-200 bg-white py-3.5 pr-5 pl-12 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <p aria-live="polite" className="sr-only">
            {searching ? `${matches} matching questions` : ''}
          </p>
        </div>
      </PageHero>

      <div className="mx-auto mt-14 grid max-w-6xl gap-10 px-6 lg:grid-cols-[14rem_1fr] lg:gap-14">
        <nav aria-label="FAQ categories" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1 text-sm">
            {FAQ_CATEGORIES.map((c) => {
              const Icon = c.icon;
              const shown = categories.find((m) => m.id === c.id)?.items.length ?? 0;
              return (
                <li key={c.id}>
                  <a
                    // A category the search has emptied has nowhere to go: without an href it is not
                    // focusable or activatable, so the keyboard cannot jump to a section that is not there.
                    href={shown === 0 ? undefined : `#${c.id}`}
                    aria-disabled={shown === 0 || undefined}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 aria-disabled:pointer-events-none aria-disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    <span className="text-brand-600 dark:text-brand-300">
                      <Icon size={16} />
                    </span>
                    <span className="flex-1">{c.title}</span>
                    <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                      {shown}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-14">
          {categories.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
              <p className="font-medium text-slate-900 dark:text-slate-100">
                No questions match “{deferred.trim()}”
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Try another word, or search the{' '}
                <a
                  href="/help/"
                  className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
                >
                  Help Centre
                </a>
                .
              </p>
            </div>
          )}
          {categories.map((c) => {
            const Icon = c.icon;
            return (
              <section
                key={c.id}
                id={c.id}
                aria-labelledby={`${c.id}-title`}
                className="scroll-mt-24"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20">
                    <Icon />
                  </span>
                  <div>
                    <h2
                      id={`${c.id}-title`}
                      className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
                    >
                      {c.title}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{c.blurb}</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {c.items.map((item) => (
                    // Remount on entering or leaving a search so matches open and a cleared search folds them.
                    <FaqItem key={`${item.q}:${searching}`} q={item.q} open={searching}>
                      {item.a}
                    </FaqItem>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
