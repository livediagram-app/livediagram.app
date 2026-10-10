'use client';

import { PrivateDotIcon, SharedDotIcon } from '@livediagram/ui';
import { ThisBrowserIcon } from '@/components/primitives/explorer-icons';
import {
  LOCAL_ONLY_DESCRIPTION,
  LOCAL_ONLY_LABEL,
  LOCAL_ONLY_TONE,
} from '@/components/primitives/LocalOnlyPill';

// A document's visibility states (docs/specs/006-document/offline-mode.md, 025-community/community.md): their
// words and tones, shared by the pill beside the title (SharedBadge) and its legend (VisibilityLegend).

export type ShareState = 'private' | 'shared' | 'team' | 'community' | 'offline';

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
  community: {
    label: 'Public',
    description: 'In the public Community: anyone can find it, view it and make their own copy.',
    badge:
      'bg-pink-50 px-2 text-[10px] font-semibold text-pink-700 ring-1 ring-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:ring-pink-500/30',
    dot: 'text-pink-500',
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

// The pill's rendered height, pinned: its caps label is trimmed to cap height, so padding alone would
// shrink it (docs/specs/004-interface-design/optical-alignment.md).
export const STATE_CHIP_HEIGHT_PX = 19;

// The icon carries its colour itself: a wrapper would hide the svg from the chip's edge compensation.
export function StateDot({ state, className }: { state: ShareState; className: string }) {
  // The Local only pill's own glyph: a browser window.
  if (state === 'offline') return <ThisBrowserIcon size={10} />;
  return state === 'private' ? (
    <PrivateDotIcon className={className} />
  ) : (
    <SharedDotIcon className={className} />
  );
}
