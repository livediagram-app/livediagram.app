'use client';

import { lazyPanel } from '@liveworkspace/ui/lazy-panel';
import { usePageErrorTitle } from './page-error-title';

type Props = { onRetry: () => void };

// The error card from its own chunk (liveworkspace/docs/specs/010-site/site.md "Behaviour"). Next ships app/error.tsx
// and app/global-error.tsx in every page's first load, and Turbopack gives each its own copy of what they import, so a
// static import of the card (the shared empty state, Button and an optically centred Lucide glyph) once cost every
// page about 20 KiB gzipped (blueprints/site.md "Performance and limits"). first-load-lazy.test.ts keeps it out.
export const LazyPageError = lazyPanel<Props>('page-error', () =>
  import('./PageError').then(
    (m) => m.PageError,
    () => PlainPageError,
  ),
);

/** What shows when the card's own code can't load (offline): the same title, words and actions, unstyled by the card. */
export function PlainPageError({ onRetry }: Props) {
  usePageErrorTitle();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 py-16 text-center sm:px-6">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Something went wrong</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        This page couldn’t be shown. Nothing you made was lost: your work is saved in its app.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-semibold">
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 cursor-pointer px-2 text-slate-900 underline underline-offset-4 dark:text-white"
        >
          Try Again
        </button>
        <a
          href="/"
          className="inline-flex min-h-11 items-center px-2 text-slate-900 underline underline-offset-4 dark:text-white"
        >
          Go to the Home Page
        </a>
      </div>
    </main>
  );
}
