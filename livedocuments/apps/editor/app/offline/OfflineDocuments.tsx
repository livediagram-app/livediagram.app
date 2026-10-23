'use client';

import { useEffect, useState } from 'react';
import type { DocumentSummary } from '@livedocuments/api-schema';
import { Brand, SITE_ID, SiteSwitcher } from '@livedocuments/ui';
import { ThisBrowserIcon } from '@/components/primitives/explorer-icons';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useOfflineConversion } from '@/hooks/persistence/useOfflineConversion';
import { offlineListDocuments, subscribeOfflineIds } from '@/lib/offline/offline-store';

// This Browser: the documents kept only in this browser (Take Offline, or made with no connection). The index never
// sees them, so no Explorer list holds them; the Explorer's This Browser row opens this page, as does the editor's
// Explorer panel. Newest first, each opening in the editor; signed in, each can be synced to the account (Sync
// Document, docs/specs/006-document/offline-mode.md).
export function OfflineDocuments() {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const { accountUserId } = useAccountBootstrap();
  useEffect(() => {
    let live = true;
    const read = () =>
      void offlineListDocuments().then(
        (list) => live && setDocuments([...list].sort((a, b) => b.savedAt - a.savedAt)),
        () => live && setDocuments([]),
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
          <Brand href="/explorer" size="md" />
        </SiteSwitcher>
        <a
          href="/explorer"
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
          Documents kept only in this browser. They aren’t in your account and don’t sync to other
          devices.
        </p>
        {documents === null ? (
          <p role="status" className="mt-8 text-sm text-slate-500 dark:text-slate-400">
            Loading…
          </p>
        ) : documents.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
            Nothing is kept only in this browser.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
            {documents.map((d) => (
              <OfflineRow key={d.id} document={d} ownerId={accountUserId ?? null} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function OfflineRow({
  document: d,
  ownerId,
}: {
  document: DocumentSummary;
  ownerId: string | null;
}) {
  const { syncToCloud } = useOfflineConversion({ id: d.id, name: d.name }, ownerId, () => {});
  return (
    <li className="flex items-center gap-2 pr-3">
      <a
        href={`/document/${encodeURIComponent(d.id)}`}
        className="flex min-w-0 flex-1 items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
      >
        <span className="truncate font-medium text-slate-900 dark:text-slate-100">
          {d.name || 'Untitled'}
        </span>
        <time
          dateTime={new Date(d.savedAt).toISOString()}
          className="shrink-0 text-xs text-slate-500 dark:text-slate-400"
        >
          {new Date(d.savedAt).toLocaleDateString()}
        </time>
      </a>
      {ownerId && (
        <button
          type="button"
          onClick={() => void syncToCloud()}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-slate-700"
        >
          Sync Document
        </button>
      )}
    </li>
  );
}
