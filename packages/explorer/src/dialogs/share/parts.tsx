// The Share dialog's shared parts: each level drawn as a pass (its colour is the level at a glance), the lifetimes
// a new pass can have, the uppercase section caption, and the options of a "which tabs" picker. The classes are
// livediagram's Share dialog's from before the Explorer split (share-dialog-parts.tsx), the look every app keeps.

import type { ReactNode } from 'react';
import type { Level, ShareLinkExpiry } from '@liveworkspace/index-client';
import { EyeIcon, PencilLineIcon, VoteIcon } from '../../ui/icons';

export type PassStyle = {
  title: string;
  blurb: string;
  Icon: () => ReactNode;
  // Solid fill: the pass's header band, the role picker's icon tiles and the Valid pill.
  solid: string;
  // Create Pass in the level's colour; white text at 4.5:1 or better.
  button: string;
  // The role picker card's border and tint.
  selected: string;
  // The role picker's row in the level's hue: its title, its hover tint, and its ring and tint once chosen.
  text: string;
  hover: string;
  chosen: string;
};

export const LEVEL_PASS: Record<Level, PassStyle> = {
  edit: {
    title: 'Editor',
    blurb: 'Works with you in real time.',
    Icon: () => <PencilLineIcon />,
    solid: 'bg-brand-700 text-white dark:bg-brand-600',
    button: 'bg-brand-700 hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700',
    selected: 'border-brand-500 bg-brand-50/70 dark:border-brand-400 dark:bg-brand-500/10',
    text: 'text-brand-700 dark:text-brand-300',
    hover: 'hover:bg-brand-50 dark:hover:bg-brand-500/10',
    chosen: 'bg-brand-50 ring-1 ring-brand-300 dark:bg-brand-500/15 dark:ring-brand-500/50',
  },
  participate: {
    title: 'Participant',
    blurb: 'Comments, votes and works items. Can’t reshape it.',
    Icon: () => <VoteIcon />,
    solid: 'bg-teal-700 text-white dark:bg-teal-600/60',
    button: 'bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700',
    selected: 'border-teal-600 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-500/10',
    text: 'text-teal-800 dark:text-teal-300',
    hover: 'hover:bg-teal-50 dark:hover:bg-teal-500/10',
    chosen: 'bg-teal-50 ring-1 ring-teal-300 dark:bg-teal-500/15 dark:ring-teal-500/50',
  },
  view: {
    title: 'Viewer',
    blurb: 'Watches along. Can’t comment or change a thing.',
    Icon: () => <EyeIcon />,
    solid: 'bg-violet-600 text-white dark:bg-violet-500/60',
    button: 'bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600',
    selected: 'border-violet-500 bg-violet-50/70 dark:border-violet-400 dark:bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-300',
    hover: 'hover:bg-violet-50 dark:hover:bg-violet-500/10',
    chosen: 'bg-violet-50 ring-1 ring-violet-300 dark:bg-violet-500/15 dark:ring-violet-500/50',
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

// A pass's bin: bordered like its hand-over buttons beside it, rose on hover.
export const PASS_BIN =
  'inline-flex items-center rounded-md border border-slate-200 px-1.5 py-1 text-slate-500 transition duration-micro hover:border-rose-300 hover:text-rose-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-rose-400/60 dark:hover:text-rose-300';

export type ShareTab = { id: string; name: string };

// The dialog's own two tabs: its passes, and the host's (livediagram's Community).
export type ShareView = 'passes' | 'app';

// '' stands for every tab: All tabs, then each tab by name in order.
export function ScopeOptions({ tabs }: { tabs: ShareTab[] }) {
  return (
    <>
      <option value="">All tabs</option>
      {tabs.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </>
  );
}
