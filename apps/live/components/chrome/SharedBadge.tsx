'use client';

import { useState } from 'react';
import { PrivateDotIcon, SharedDotIcon } from '@/components/chrome/share-state-icons';

// The visibility pill rendered beside the diagram title, split out of
// EditorHeader. Share links win: a shared team diagram reads "Shared" as
// normal; "Team" covers the team-but-unshared case where "Private" would be a
// lie (every joined member can open it); "Offline" (spec/76) supersedes
// "Private" for browser-only diagrams. Hovering (or focusing) the pill opens a
// legend popover explaining every badge, with the current one highlighted, so
// the four states can be compared in place instead of hunting each tooltip.

type ShareState = 'private' | 'shared' | 'team' | 'offline';

// Per-state pill styling, keyed by the resolved share state so the label /
// description / badge + dot colours stay in one table rather than four
// parallel `state === ...` ternaries. Also drives the legend rows.
const SHARE_STATE_META: Record<
  ShareState,
  { label: string; description: string; badge: string; dot: string }
> = {
  private: {
    label: 'Private',
    description: 'Only visible to you.',
    badge:
      'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
    dot: 'text-slate-400',
  },
  shared: {
    label: 'Shared',
    description: 'Anyone with a link can view.',
    badge:
      'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
    dot: 'text-emerald-500',
  },
  team: {
    label: 'Team',
    description: 'In a team library: every member of the team can open it.',
    badge:
      'inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30',
    dot: 'text-brand-500',
  },
  // Offline Mode (spec/76): saved only in this browser, never on the server.
  // Amber so it reads as a distinct, deliberate state rather than a neutral
  // default.
  offline: {
    label: 'Offline',
    description: 'Saved only in this browser. Not synced, not backed up.',
    badge:
      'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
    dot: 'text-amber-500',
  },
};

// Legend read order: the default first, then the progressively-wider
// audiences, with Offline last as the deliberate opt-out.
const LEGEND_ORDER: ShareState[] = ['private', 'shared', 'team', 'offline'];

function StateDot({ state, className }: { state: ShareState; className: string }) {
  return (
    <span aria-hidden className={className}>
      {state === 'private' || state === 'offline' ? <PrivateDotIcon /> : <SharedDotIcon />}
    </span>
  );
}

export function SharedBadge({
  shareable,
  team,
  offline,
}: {
  shareable: boolean;
  team?: boolean;
  offline?: boolean;
}) {
  const state: ShareState = offline ? 'offline' : shareable ? 'shared' : team ? 'team' : 'private';
  const meta = SHARE_STATE_META[state];
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span tabIndex={0} aria-label={`${meta.label}: ${meta.description}`} className={meta.badge}>
        <StateDot state={state} className={meta.dot} />
        {meta.label}
      </span>
      {/* The badge legend (spec/76 follow-up): every visibility state with its
          meaning, current row highlighted. Anchored below the pill; the header
          creates its own stacking context and doesn't clip overflow (the
          AuthControls menu relies on the same), so no portal is needed. */}
      {open ? (
        <div
          aria-hidden
          className="absolute left-1/2 top-full z-10 mt-2 w-80 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-left shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
        >
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Diagram visibility
          </p>
          <ul className="flex flex-col gap-0.5">
            {LEGEND_ORDER.map((s) => {
              const m = SHARE_STATE_META[s];
              const current = s === state;
              return (
                <li
                  key={s}
                  className={`flex items-start gap-2.5 rounded-md px-2 py-1.5 ${
                    current
                      ? 'bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700'
                      : ''
                  }`}
                >
                  <span className={`${m.badge} mt-px shrink-0`}>
                    <StateDot state={s} className={m.dot} />
                    {m.label}
                  </span>
                  <span className="min-w-0 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                    {m.description}
                    {current ? (
                      <span className="ml-1 font-medium text-slate-700 dark:text-slate-200">
                        (this diagram)
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </span>
  );
}
