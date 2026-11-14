import type { ReactNode } from 'react';
import { EmptyState } from '@liveworkspace/ui';
import { Wordmark } from './Wordmark';

// The card a page that cannot be shown draws (liveworkspace/docs/specs/010-site/site.md "Behaviour"): the logo, home,
// over the shared empty state in a main landmark, its heading the page's h1, the page's actions, and under them a quieter way to the status
// page. No hooks and no client code, so the not-found page draws it on the server and ships no script for it; the
// error card (PageError) draws it from its own chunk.
export const STATUS_HREF = '/status';
export const STATUS_LINK = 'Check the Status Page';

export function ErrorCard({
  icon,
  title,
  description,
  statusLead,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  /** The words before the status link: why someone here might want it. */
  statusLead: string;
  /** The page's actions, the first the primary. */
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
      <a
        href="/"
        className="mb-6 self-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <Wordmark />
      </a>
      <EmptyState icon={icon} heading="h1" title={title} description={description}>
        <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>
        <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
          {statusLead}{' '}
          <a
            href={STATUS_HREF}
            className="inline-flex items-center font-medium pointer-coarse:min-h-11 text-slate-700 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900 hover:decoration-slate-500 dark:text-slate-200 dark:decoration-slate-600 dark:hover:text-white dark:hover:decoration-slate-400"
          >
            {STATUS_LINK}
          </a>
        </p>
      </EmptyState>
    </main>
  );
}
