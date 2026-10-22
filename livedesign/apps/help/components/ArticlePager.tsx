import Link from 'next/link';
import { CONTACT_FORM_URL } from '@livedesign/ui';
import type { ArticleLink } from '@/lib/article-neighbours';
import { ArrowLeftIcon, ArrowRightIcon, MessageIcon } from '@/lib/chrome-icons';

// The foot of an article (docs/specs/018-help/help-pages.md "Article pages"): the previous and next articles in
// its reading order, and the way on for a reader the article did not help.

const PAGER_CARD = 'card-glow group flex flex-col rounded-xl bg-white px-5 py-4 dark:bg-slate-900';

export function ArticlePager({ prev, next }: { prev?: ArticleLink; next?: ArticleLink }) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="More in this topic" className="mt-12 grid gap-3 sm:grid-cols-2">
      {prev ? (
        <Link href={prev.href} rel="prev" className={PAGER_CARD}>
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <ArrowLeftIcon className="transition-transform group-hover:-translate-x-0.5" />
            Previous
          </span>
          <span className="mt-1 font-semibold text-slate-900 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-200">
            {prev.title}
          </span>
        </Link>
      ) : (
        <span aria-hidden className="hidden sm:block" />
      )}
      {next && (
        <Link href={next.href} rel="next" className={`${PAGER_CARD} sm:items-end sm:text-right`}>
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Next
            <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="mt-1 font-semibold text-slate-900 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-200">
            {next.title}
          </span>
        </Link>
      )}
    </nav>
  );
}

export function StillNeedHelp() {
  return (
    <aside className="mt-10 flex flex-col gap-4 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-brand-500/30 dark:bg-brand-500/10">
      <div>
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">Still need help?</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Try{' '}
          <Link
            href="/troubleshooting/"
            className="text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
          >
            Troubleshooting
          </Link>
          , or tell us what you were trying to do.
        </p>
      </div>
      <a
        href={CONTACT_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="relative inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors touch-target-y hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <MessageIcon />
        Contact us
      </a>
    </aside>
  );
}
