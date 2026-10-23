'use client';

import { useEffect, useState } from 'react';
import type { ProjectSummary } from '@liveplanner/api-schema';
import { Brand, SITE_ID, SiteSwitcher } from '@liveplanner/ui';
import { ThisBrowserIcon } from '@/components/primitives/explorer-icons';
import { liveworkspaceExplorer } from '@/lib/explorer-redirect';
import { offlineListProjects, subscribeOfflineIds } from '@/lib/offline/offline-store';

// This Browser: the plans kept only in this browser (Take Offline, or made with no connection). The index never
// sees them, so the Explorer on liveworkspace.app can't list them; its This Browser row opens this page, as does the
// editor's Explorer panel. Newest first, each opening in the editor.
export function OfflinePlans() {
  const [plans, setPlans] = useState<ProjectSummary[] | null>(null);
  useEffect(() => {
    let live = true;
    const read = () =>
      void offlineListProjects().then(
        (list) => live && setPlans([...list].sort((a, b) => b.savedAt - a.savedAt)),
        () => live && setPlans([]),
      );
    read();
    const stop = subscribeOfflineIds(read);
    return () => {
      live = false;
      stop();
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-900">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-900">
        <SiteSwitcher current={SITE_ID}>
          <Brand href={liveworkspaceExplorer()} size="md" />
        </SiteSwitcher>
        <a
          href={liveworkspaceExplorer()}
          className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          Open the Explorer
        </a>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
          <ThisBrowserIcon aria-hidden />
          This Browser
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Plans kept only in this browser. They aren’t in your account and don’t sync to other
          devices.
        </p>
        {plans === null ? (
          <p role="status" className="mt-8 text-sm text-slate-500 dark:text-slate-400">
            Loading…
          </p>
        ) : plans.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
            Nothing is kept only in this browser.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
            {plans.map((p) => (
              <li key={p.id}>
                <a
                  href={`/project/${encodeURIComponent(p.id)}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                    {p.name || 'Untitled'}
                  </span>
                  <time
                    dateTime={new Date(p.savedAt).toISOString()}
                    className="shrink-0 text-xs text-slate-500 dark:text-slate-400"
                  >
                    {new Date(p.savedAt).toLocaleDateString()}
                  </time>
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
