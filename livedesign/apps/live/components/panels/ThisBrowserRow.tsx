'use client';

import { useEffect, useState } from 'react';
import { ThisBrowserIcon } from '@/components/primitives/explorer-icons';
import { offlineIdCount, subscribeOfflineIds } from '@/lib/offline/offline-store';

// This Browser in the editor's Explorer panel (docs/specs/013-workspace/explorer-structure.md "This Browser"): the
// designs kept only in this browser, which the index never sees, so no Explorer list holds them. A row with their
// count opens their page, /offline. Shown only while there are some.
export function ThisBrowserRow() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    const read = () => void offlineIdCount().then((n) => live && setCount(n));
    read();
    const stop = subscribeOfflineIds(read);
    return () => {
      live = false;
      stop();
    };
  }, []);
  if (count === 0) return null;
  return (
    <a
      href="/offline"
      data-this-browser=""
      className="mx-1.5 my-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <span aria-hidden className="text-slate-500 dark:text-slate-400">
        <ThisBrowserIcon />
      </span>
      <span className="flex-1">This Browser</span>
      <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{count}</span>
    </a>
  );
}
