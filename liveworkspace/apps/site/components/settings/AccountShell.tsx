'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { signInHref } from '@/lib/accounts';
import { useSession } from '@/lib/session';
import { Footer } from '../Footer';
import { Header } from '../Header';

const TABS = [
  { href: '/account/teams', label: 'Teams' },
  { href: '/account/tokens', label: 'API tokens' },
];

const noChange = () => () => {};

// The frame of the account pages (liveworkspace/docs/site.md "Your account"): the title, a tab per
// page, and the page itself once the person is known to be signed in. Signed out, it asks them to
// sign in and come back here.
export function AccountShell({
  path,
  intro,
  children,
}: {
  path: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  const session = useSession();
  const here = useSyncExternalStore(
    noChange,
    () => window.location.pathname,
    () => path,
  );

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm font-semibold tracking-[.18em] text-slate-500 uppercase dark:text-slate-400">
          Your account
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          {session.state === 'in' ? `Hello, ${session.name}` : 'Your account'}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          {intro}
        </p>
        <nav
          aria-label="Account"
          className="mt-8 inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm font-medium shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {TABS.map((tab) => (
            <a
              key={tab.href}
              href={tab.href}
              aria-current={tab.href === path ? 'page' : undefined}
              className="rounded-full px-4 py-1.5 text-slate-600 transition-colors duration-micro hover:text-slate-900 aria-[current=page]:bg-slate-900 aria-[current=page]:text-white dark:text-slate-300 dark:hover:text-white dark:aria-[current=page]:bg-white dark:aria-[current=page]:text-slate-900"
            >
              {tab.label}
            </a>
          ))}
        </nav>

        <div className="mt-10">
          {session.state === 'checking' && (
            <div aria-busy className="space-y-3">
              <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70" />
              <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70" />
            </div>
          )}
          {session.state === 'out' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                Sign in to see your account
              </p>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Your teams and API tokens are here, the same in every app.
              </p>
              <a
                href={signInHref(here)}
                className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-micro hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Sign in
              </a>
            </div>
          )}
          {session.state === 'in' && children}
        </div>
      </main>
      <Footer />
    </>
  );
}

// The site's buttons, by weight.
export const BUTTON = {
  primary:
    'inline-flex cursor-pointer items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors duration-micro hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200',
  secondary:
    'inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-micro hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
  danger:
    'inline-flex cursor-pointer items-center justify-center rounded-full px-3 py-1.5 text-sm font-semibold text-rose-700 transition-colors duration-micro hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-500/10',
};

export const INPUT =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-white dark:focus:ring-white/10';

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </section>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
    >
      {children}
    </p>
  );
}
