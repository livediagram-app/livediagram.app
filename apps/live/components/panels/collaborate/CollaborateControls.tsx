'use client';

// The Collaborate panel's two controls (docs/specs/012-collaboration/assigned-actions.md §5): the Open / Resolved
// segmented control on the shared sliding pill, and the kind chips under it.

import { ACTIVE_SEGMENT, SEGMENT_TRACK, ActionIcon, CommentIcon } from '@livediagram/ui';
import { SegmentSlider } from '@/components/primitives/SegmentSlider';
import type { CollaborateKind, CollaborateSide } from './collaborate-model';

const SIDES: { id: CollaborateSide; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
];

export function SideTabs({
  value,
  counts,
  onChange,
}: {
  value: CollaborateSide;
  counts: Record<CollaborateSide, number>;
  onChange: (next: CollaborateSide) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Show open or resolved"
      className={`relative grid grid-cols-2 rounded-lg p-0.5 ${SEGMENT_TRACK}`}
    >
      <SegmentSlider
        count={SIDES.length}
        index={SIDES.findIndex((s) => s.id === value)}
        className={ACTIVE_SEGMENT}
      />
      {SIDES.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.id)}
            className={`relative z-10 flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-semibold transition-colors ${
              active
                ? 'text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {s.label}
            <span
              className={`inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold transition-colors ${
                active
                  ? 'bg-white/25 text-white'
                  : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
              }`}
            >
              <span className="text-optical-centre">{counts[s.id]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const KINDS: { id: CollaborateKind; label: string; icon?: React.ReactNode }[] = [
  { id: 'all', label: 'All' },
  { id: 'comments', label: 'Comments', icon: <CommentIcon size={11} /> },
  { id: 'actions', label: 'Actions', icon: <ActionIcon size={11} /> },
];

// Three labelled chips rather than one button cycling through hidden states:
// what the list is narrowed to is always on screen.
export function KindChips({
  value,
  counts,
  onChange,
}: {
  value: CollaborateKind;
  counts: Record<CollaborateKind, number>;
  onChange: (next: CollaborateKind) => void;
}) {
  return (
    // A grid rather than a free row: All keeps its natural width and the other
    // two share the rest, so "Comments 2" and "Actions 2" always fit the
    // panel instead of the last chip running off its right edge.
    <div
      role="group"
      aria-label="Filter by kind"
      className="grid grid-cols-[auto_1fr_1fr] items-center gap-1"
    >
      {KINDS.map((k) => {
        const active = k.id === value;
        return (
          <button
            key={k.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(k.id)}
            className={`inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-colors ${
              active
                ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {k.icon ? <span aria-hidden>{k.icon}</span> : null}
            <span className="text-optical-centre">{k.label}</span>
            <span className="text-optical-centre tabular-nums opacity-70">{counts[k.id]}</span>
          </button>
        );
      })}
    </div>
  );
}
