'use client';

import { useEffect, useState } from 'react';
import { apiListDiagrams } from '@/lib/api-client';
import { relativeSince, useRelativeTimeTick } from '@/lib/relative-time';

type RecentItem = { id: string; name: string; savedAt: number | null };

// A small "jump back in" card that pops out to the RIGHT of the new-diagram
// wizard (spec/14), listing the 5 most recently-saved diagrams the user
// owns. Deliberately separate from the create flow: it's a side affordance
// for returning users, hidden entirely for someone with no diagrams yet
// (and on narrow viewports where the wizard already fills the width). Each
// row opens that diagram directly.
export function RecentDiagramsCard({ ownerId }: { ownerId: string | null }) {
  const [recent, setRecent] = useState<RecentItem[] | null>(null);
  useRelativeTimeTick();

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    void apiListDiagrams(ownerId)
      .then((list) => {
        if (cancelled) return;
        const top = [...list]
          .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
          .slice(0, 5)
          .map((d) => ({ id: d.id, name: d.name, savedAt: d.savedAt ?? null }));
        setRecent(top);
      })
      .catch(() => {
        // Best-effort: a returning user just doesn't get the shortcut.
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  if (!recent || recent.length === 0) return null;

  return (
    // Rendered inside the page's right rail (see /new page.tsx), which owns
    // the positioning; this is just the card. A gentle hover lift gives it
    // life without tilting the text (a sub-pixel rotation made the resting
    // card render blurry).
    <div className="pointer-events-auto w-64 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 ring-1 ring-black/5 transition duration-200 hover:-translate-y-0.5 hover:shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40">
      <div className="flex items-center gap-2 rounded-t-2xl border-b border-slate-100 bg-gradient-to-r from-brand-50 to-transparent px-4 py-3 dark:border-slate-800 dark:from-brand-500/10">
        <ClockIcon />
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            Jump back in
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            Your recent diagrams
          </span>
        </div>
      </div>
      <ul className="flex flex-col p-1.5">
        {recent.map((d) => (
          <li key={d.id}>
            <a
              href={`/diagram/${d.id}`}
              className="group flex items-center gap-2 rounded-lg px-2.5 py-2 transition hover:bg-brand-50 dark:hover:bg-brand-500/10"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium text-slate-700 group-hover:text-brand-700 dark:text-slate-200 dark:group-hover:text-brand-200">
                  {d.name || 'Untitled diagram'}
                </span>
                {d.savedAt != null ? (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {relativeSince(d.savedAt)}
                  </span>
                ) : null}
              </span>
              <ChevronRight />
            </a>
          </li>
        ))}
      </ul>
      {/* Footer: the card caps at 5 rows, so returning users with more
            history get a way into the full library — the Explorer's
            Recent page, the same list uncapped. */}
      <a
        href="/explorer/recent"
        className="group flex items-center justify-center gap-1.5 rounded-b-2xl border-t border-slate-100 px-4 py-2.5 text-[11px] font-medium text-slate-500 transition hover:bg-brand-50 hover:text-brand-700 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-200"
      >
        Open Explorer
        <ChevronRight />
      </a>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 text-brand-500 dark:text-brand-400"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2 1.5" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 dark:text-slate-600"
    >
      <path d="M4.5 2.5L8 6l-3.5 3.5" />
    </svg>
  );
}
