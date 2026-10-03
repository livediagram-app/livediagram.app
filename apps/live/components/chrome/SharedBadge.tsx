'use client';

import { useId, useState, type HTMLAttributes } from 'react';
import { Chip, PrivateDotIcon, SharedDotIcon } from '@livediagram/ui';
import { ThisBrowserIcon } from '@/components/primitives/explorer-icons';
import {
  LOCAL_ONLY_DESCRIPTION,
  LOCAL_ONLY_LABEL,
  LOCAL_ONLY_TONE,
} from '@/components/primitives/LocalOnlyPill';

// The visibility pill rendered beside the document title, split out of
// EditorHeader. Share links win: a shared team document reads "Shared" as
// normal; "Team" covers the team-but-unshared case where "Private" would be a
// lie (every joined member can open it); "Local only" (docs/specs/006-document/offline-mode.md)
// supersedes "Private" for browser-only documents, matching the Explorer's Local only pill. Hovering (or focusing) the pill opens a
// legend popover explaining every badge, with the current one highlighted, so
// the four states can be compared in place instead of hunting each hover card.

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
      'bg-slate-100 px-2 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
    dot: 'text-slate-400',
  },
  shared: {
    label: 'Shared',
    description: 'Anyone with a link can view.',
    badge:
      'bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
    dot: 'text-emerald-500',
  },
  team: {
    label: 'Team',
    description: 'In a team library: every member of the team can open it.',
    badge:
      'bg-brand-50 px-2 text-[10px] font-semibold text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30',
    dot: 'text-brand-500 dark:text-brand-400',
  },
  // Offline Mode (docs/specs/006-document/offline-mode.md): saved only in this browser, never on the
  // server. The Local only pill's words, sentence and amber tone (text 4.5:1 on its fill, ring 3:1).
  offline: {
    label: LOCAL_ONLY_LABEL,
    description: LOCAL_ONLY_DESCRIPTION,
    badge: `px-2 text-[10px] font-semibold ${LOCAL_ONLY_TONE}`,
    dot: '',
  },
};

// Legend read order: the default first, then the progressively-wider
// audiences, with Local only last as the deliberate opt-out.
const LEGEND_ORDER: ShareState[] = ['private', 'shared', 'team', 'offline'];

// The pill's rendered height, pinned: its caps label is trimmed to cap height, so padding alone would
// shrink it (docs/specs/004-interface-design/optical-alignment.md).
const STATE_CHIP_HEIGHT_PX = 19;

// The icon carries its colour itself: a wrapper would hide the svg from the chip's edge compensation.
function StateDot({ state, className }: { state: ShareState; className: string }) {
  // The Local only pill's own glyph: a browser window.
  if (state === 'offline') return <ThisBrowserIcon size={10} />;
  return state === 'private' ? (
    <PrivateDotIcon className={className} />
  ) : (
    <SharedDotIcon className={className} />
  );
}

function ShareStateChip({
  state,
  className = '',
  ...rest
}: { state: ShareState; className?: string } & HTMLAttributes<HTMLSpanElement>) {
  const m = SHARE_STATE_META[state];
  return (
    <Chip
      height={STATE_CHIP_HEIGHT_PX}
      caps
      icon={<StateDot state={state} className={m.dot} />}
      className={`${m.badge} ${className}`}
      {...rest}
    >
      {m.label}
    </Chip>
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
  const descriptionId = useId();
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <ShareStateChip
        state={state}
        tabIndex={0}
        aria-label={meta.label}
        aria-describedby={descriptionId}
      />
      <span id={descriptionId} className="sr-only">
        {meta.description}
      </span>
      {/* The badge legend (docs/specs/006-document/offline-mode.md follow-up): every visibility state with its
          meaning, current row highlighted. Anchored below the pill; the header
          creates its own stacking context and doesn't clip overflow (the
          AuthControls menu relies on the same), so no portal is needed. */}
      {open ? (
        <div
          aria-hidden
          className="absolute left-1/2 top-full z-10 mt-2 w-80 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-left shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
        >
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">
            Document visibility
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
                  <ShareStateChip state={s} className="mt-px" />
                  <span className="min-w-0 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                    {m.description}
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
