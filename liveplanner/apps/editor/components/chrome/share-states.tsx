'use client';

import { PrivateDotIcon, SharedDotIcon } from '@liveplanner/ui';
import { ThisBrowserIcon } from '@/components/primitives/explorer-icons';
import {
  THIS_BROWSER_DESCRIPTION,
  THIS_BROWSER_LABEL,
  THIS_BROWSER_TONE,
} from '@liveworkspace/workbench/components/primitives/ThisBrowserPill';

// A project's visibility states (docs/specs/006-project/offline-mode.md): their
// words and tones, shared by the pill beside the title (SharedBadge) and its legend (VisibilityLegend).

export type ShareState = 'private' | 'shared' | 'team' | 'offline';

// Per-state pill styling, keyed by the resolved share state so the label /
// description / badge + dot colours stay in one table rather than four
// parallel `state === ...` ternaries. Also drives the legend rows.
export const SHARE_STATE_META: Record<
  ShareState,
  { label: string; description: string; badge: string; dot: string }
> = {
  private: {
    label: 'Private',
    description: 'Only visible to you.',
    badge:
      'bg-slate-100 px-2 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
    dot: 'text-slate-400',
  },
  shared: {
    label: 'Shared',
    description: 'Anyone with a link can open it.',
    badge:
      'bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
    dot: 'text-emerald-500',
  },
  team: {
    label: 'Team',
    description: 'In a team library: every member of the team can open it.',
    badge:
      'bg-brand-50 px-2 text-[10px] font-semibold text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30',
    dot: 'text-brand-700 dark:text-brand-400',
  },
  // Offline Mode (docs/specs/006-project/offline-mode.md): saved only in this browser, never on the
  // server. The This Browser pill's words, sentence and teal tone (text 4.5:1 on its fill, ring 3:1):
  // teal is no app's accent and no status colour.
  offline: {
    label: THIS_BROWSER_LABEL,
    description: THIS_BROWSER_DESCRIPTION,
    badge: `px-2 text-[10px] font-semibold ${THIS_BROWSER_TONE}`,
    dot: '',
  },
};

// The pill's rendered height, pinned: its caps label is trimmed to cap height, so padding alone would
// shrink it (docs/specs/004-interface-design/optical-alignment.md).
export const STATE_CHIP_HEIGHT_PX = 19;

// The icon carries its colour itself: a wrapper would hide the svg from the chip's edge compensation.
export function StateDot({ state, className }: { state: ShareState; className: string }) {
  // The This Browser pill's own glyph: a browser window.
  if (state === 'offline') return <ThisBrowserIcon size={10} />;
  return state === 'private' ? (
    <PrivateDotIcon className={className} />
  ) : (
    <SharedDotIcon className={className} />
  );
}
