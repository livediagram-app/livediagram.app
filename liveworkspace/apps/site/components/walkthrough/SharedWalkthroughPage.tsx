'use client';

// A shared walkthrough (liveworkspace/docs/specs/006-media/walkthroughs.md "Each walkthrough's menu"): the video full
// width, its title, who made it and when, and the app it was made in. Nothing of the document. A code that is off or
// unknown says Walkthrough Not Found.

import { REGISTERED_APP_SITES } from '@liveworkspace/sites';
import { Spinner } from '@liveworkspace/ui';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Footer } from '../Footer';
import { Header } from '../Header';

const SHARED = '/api/media/walkthroughs/shared';
const noChange = () => () => {};

type Shared = {
  title: string;
  author: string | null;
  app: string;
  durationMs: number;
  createdAt: number;
};

/** The code in the address (`?c=`), or null when there is none in shape. */
export function walkthroughCodeFrom(search: string): string | null {
  const code = new URLSearchParams(search).get('c');
  return code && /^[A-Za-z0-9_-]{22}$/.test(code) ? code : null;
}

const DATE = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function SharedWalkthroughPage() {
  const code = useSyncExternalStore(
    noChange,
    () => walkthroughCodeFrom(window.location.search),
    () => undefined,
  );
  const [loaded, setLoaded] = useState<
    { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; shared: Shared }
  >({ kind: 'loading' });
  const state = code === null ? ({ kind: 'missing' } as const) : loaded;

  useEffect(() => {
    if (!code) return;
    let live = true;
    void fetch(`${SHARED}/${code}`, { credentials: 'omit' })
      .then(async (res) => (res.ok ? ((await res.json()) as Shared) : null))
      .catch(() => null)
      .then((shared) => {
        if (live) setLoaded(shared ? { kind: 'ready', shared } : { kind: 'missing' });
      });
    return () => {
      live = false;
    };
  }, [code]);

  const site =
    state.kind === 'ready' ? REGISTERED_APP_SITES.find((s) => s.id === state.shared.app) : null;

  return (
    <div data-shared-walkthrough="" className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-16">
        {state.kind === 'loading' || code === undefined ? (
          <div aria-busy className="flex justify-center py-24 text-slate-400">
            <Spinner size={20} />
          </div>
        ) : state.kind === 'missing' ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
              Walkthrough Not Found
            </h1>
            <p className="mt-3 text-[15px] text-slate-600 dark:text-slate-300">
              This link is off, or it was never one. Ask whoever sent it for a new link.
            </p>
          </div>
        ) : (
          <article className="flex flex-col gap-5">
            <video
              src={`${SHARED}/${code}/media`}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-2xl bg-black shadow-2xl shadow-slate-900/20 dark:shadow-black/40"
            />
            <header className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                  {state.shared.title}
                </h1>
                <p className="mt-1 text-[14px] text-slate-500 dark:text-slate-400">
                  {state.shared.author ? `By ${state.shared.author} · ` : ''}
                  {DATE.format(state.shared.createdAt)}
                </p>
              </div>
              {site ? (
                <a
                  href={site.url}
                  className="shrink-0 text-[14px] font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-slate-50"
                >
                  Made with {site.name}
                </a>
              ) : null}
            </header>
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
}
