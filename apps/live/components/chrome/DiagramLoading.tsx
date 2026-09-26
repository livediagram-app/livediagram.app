'use client';

import { useEffect, useState } from 'react';
import { RefreshIcon } from '@livediagram/ui';
import { DiagramBuildAnimation } from '@/components/canvas/DiagramBuildAnimation';

// Full-screen "loading your diagram…" placeholder. Stand-in for the
// editor chrome while the post-mount fetch resolves a ?d= or ?s= URL.
// Reassures the user that data isn't lost: previously they'd briefly
// see the empty-canvas welcome card and assume it had been wiped.
// If the fetch hasn't returned within 10 seconds, surfaces a "taking
// too long" message and a Refresh button so the user has an out.
//
// Lifted out of editor-page.tsx (which is the only consumer) just to
// give that file its 60 lines back.
export function DiagramLoading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 10000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    // This is a whole SCREEN, not a panel: it is the only thing between the
    // click and the editor, so it has to honour the appearance like every
    // other route does (docs/specs/007-editor/live-app.md). It was light-only, which meant a dark-chrome
    // user got a white flash on every diagram open.
    <div className="flex flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <DiagramBuildAnimation />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Loading your diagram…
        </p>
        {slow ? (
          <div className="mt-2 flex flex-col items-center gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">It&apos;s taking too long.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-slate-800 dark:hover:text-brand-200"
            >
              <RefreshIcon size={13} strokeWidth={1.6} />
              Refresh
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
