// The Share dialog's shared parts: each level drawn as a pass (its colour is the level at a glance), the lifetimes
// a new pass can have, the uppercase section caption, and the options of a "which tabs" picker.

import type { ReactNode } from 'react';
import type { Level, ShareLinkExpiry } from '@liveworkspace/index-client';
import { EyeIcon, PencilLineIcon, VoteIcon } from '../../ui/icons';

export type PassStyle = {
  title: string;
  blurb: string;
  Icon: () => ReactNode;
  // The pass's header band, and the composer's Create Pass in the level's colour.
  solid: string;
  button: string;
  // The level's chosen card in the composer.
  selected: string;
  chip: string;
};

export const LEVEL_PASS: Record<Level, PassStyle> = {
  edit: {
    title: 'Editor',
    blurb: 'Works with you in real time.',
    Icon: () => <PencilLineIcon />,
    solid: 'bg-brand-700 text-white dark:bg-brand-600',
    button: 'bg-brand-700 hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700',
    selected: 'border-brand-500 bg-brand-50/70 dark:border-brand-400 dark:bg-brand-500/10',
    chip: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30',
  },
  participate: {
    title: 'Participant',
    blurb: 'Comments, votes and works items. Can’t reshape it.',
    Icon: () => <VoteIcon />,
    solid: 'bg-teal-700 text-white dark:bg-teal-600/60',
    button: 'bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700',
    selected: 'border-teal-600 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-500/10',
    chip: 'bg-teal-50 text-teal-800 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30',
  },
  view: {
    title: 'Viewer',
    blurb: 'Watches along. Can’t comment or change a thing.',
    Icon: () => <EyeIcon />,
    solid: 'bg-violet-500 text-white dark:bg-violet-500/60',
    button: 'bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600',
    selected: 'border-violet-500 bg-violet-50/70 dark:border-violet-400 dark:bg-violet-500/10',
    chip: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30',
  },
};

// The cards' order: the most a link can do first, since Editor is what a new pass starts as.
export const LEVEL_ORDER: Level[] = ['edit', 'participate', 'view'];

// A new pass starts as an Editor's: the dialog is opened to bring someone in to work on it.
export const DEFAULT_LEVEL: Level = 'edit';

export const LIFETIMES: Record<ShareLinkExpiry, string> = {
  never: 'Forever',
  week: '1 week',
  month: '1 month',
  sixMonths: '6 months',
};

export const SECTION_LABEL =
  'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

export const SELECT =
  'rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

// A pass's bin: bordered like its hand-over buttons beside it, rose on hover.
export const PASS_BIN =
  'inline-flex items-center rounded-md border border-slate-200 px-1.5 py-1 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-rose-400/60 dark:hover:text-rose-300';

export type ShareTab = { id: string; name: string };

// '' stands for every tab.
export function ScopeOptions({ tabs }: { tabs: ShareTab[] }) {
  return (
    <>
      <option value="">Every tab</option>
      {tabs.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </>
  );
}
