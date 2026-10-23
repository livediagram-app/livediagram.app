import { lucideArrowRight } from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { AppLogo } from '@/components/landing/AppLogo';
import { listedApps } from '@/lib/apps';

// Product Comparison (liveworkspace/docs/site.md): each app compares itself with the tools it
// answers on its own site (packages/comparisons/README.md), so this page only points at them. The
// old /alternatives addresses redirect here and to each app's pages (public/_redirects).

const TITLE = 'Product Comparison';
const DESCRIPTION =
  'Honest, side-by-side comparisons of each liveworkspace app with the tools it answers, on each app’s own site.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/compare' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/compare', type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

const ArrowIcon = lucideGlyph(lucideArrowRight, 16);

export default function ComparePage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 sm:pt-20 sm:pb-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Product Comparison
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl dark:text-white">
            How each app compares
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            Thinking about another tool? Each app sets itself side by side with the tools it
            answers, including where each one is the better pick. Pick the app.
          </p>
        </div>
        <ul className="mt-12 grid gap-5 sm:grid-cols-2">
          {listedApps().map((app) => (
            <li key={app.id}>
              <a
                href={`${app.url}/alternatives`}
                style={{ '--lw-ink': app.deep, '--lw-ink-dark': app.accent } as CSSProperties}
                className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lw-ink)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900"
              >
                <AppLogo app={app} size="md" />
                <span className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {app.pitch}.
                </span>
                <span className="mt-auto flex items-center justify-between pt-6 text-sm font-medium text-[var(--lw-ink)] dark:text-[var(--lw-ink-dark)]">
                  See how {app.name} compares
                  <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 transition group-hover:bg-[var(--lw-ink)] group-hover:text-white motion-reduce:transition-none dark:bg-slate-800">
                    <ArrowIcon />
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
