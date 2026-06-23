'use client';

import { useEffect, useState } from 'react';
import { DiagramBuildAnimation } from '@/components/canvas/DiagramBuildAnimation';

// Full-screen "loading your diagram…" placeholder. Stand-in for the
// editor chrome while the post-mount fetch resolves a ?d= or ?s= URL.
// Reassures the user that data isn't lost: previously they'd briefly
// see the empty-canvas welcome card and assume it had been wiped.
// If the fetch hasn't returned within 10 seconds, surfaces a "taking
// too long" message and a Refresh button so the user has an out.
//
// Lifted out of editor-page.tsx (which is the only consumer) just to
// give that file its 60 lines back. RefreshIcon stays co-located
// because it has no other caller.
export function DiagramLoading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 10000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <DiagramBuildAnimation />
        <p className="text-sm font-medium text-slate-600">Loading your diagram…</p>
        {slow ? (
          <div className="mt-2 flex flex-col items-center gap-2">
            <p className="text-xs text-slate-500">It&apos;s taking too long.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              <RefreshIcon />
              Refresh
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 5.5" />
      <path d="M13.5 2.5v3h-3" />
      <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 10.5" />
      <path d="M2.5 13.5v-3h3" />
    </svg>
  );
}
