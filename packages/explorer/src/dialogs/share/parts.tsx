// The Share dialog's shared parts: each level drawn as a pass (its colour is the level at a glance), the lifetimes
// a new pass can have, the uppercase section caption, and the options of a "which tabs" picker. The classes are
// livediagram's Share dialog's from before the Explorer split (share-dialog-parts.tsx), the look every app keeps.

import type { ReactNode } from 'react';
import type { App, Level, ShareLinkExpiry } from '@liveworkspace/index-client';
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
  // The role picker's row in the level's hue: its title and its hover tint.
  text: string;
  hover: string;
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
  },
  participate: {
    title: 'Participant',
    blurb: 'Comments, votes and works on items. Can’t reshape it.',
    Icon: () => <VoteIcon />,
    solid: 'bg-teal-700 text-white dark:bg-teal-600/60',
    // Dark mode keeps teal-700 under the white label: teal-600 read 3.67:1, under WCAG AA's 4.5.
    button: 'bg-teal-700 hover:bg-teal-800 dark:bg-teal-700 dark:hover:bg-teal-800',
    selected: 'border-teal-600 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-500/10',
    text: 'text-teal-800 dark:text-teal-300',
    hover: 'hover:bg-teal-50 dark:hover:bg-teal-500/10',
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
  },
};

// An app's own words for a level's blurb, where the shared one would mislead (liveworkspace/docs/specs/004-index/
// one-explorer-contracts.md): livehuddle's Participant walks and adds nothing; liveknowledge's writes and verifies.
export const APP_LEVEL_BLURBS: Partial<Record<App, Partial<Record<Level, string>>>> = {
  livehuddle: { participate: 'Walks, talks and uses the pieces; adds nothing.' },
  // liveknowledge's Participant is an Editor less three things (its share-roles.md): nothing there to vote on.
  liveknowledge: {
    participate: 'Writes and verifies pages. Can’t change the style or review period.',
  },
};

/** A level's blurb for an app: its own words, or the shared one. */
export function levelBlurb(level: Level, app?: App): string {
  return (app && APP_LEVEL_BLURBS[app]?.[level]) ?? LEVEL_PASS[level].blurb;
}

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

// A settings card's lower part (Password Protection, Sign In), under a hairline and lined up with its words (px-4),
// so it reads as the setting's own detail; a row in it; and its quiet note.
export const SETTING_DETAIL =
  'flex animate-fade-in flex-col gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-700/70';
export const SETTING_DETAIL_ROW = 'flex min-w-0 items-center gap-2';
export const SETTING_NOTE = 'text-xs leading-relaxed text-slate-500 dark:text-slate-400';
// A settings card: the Settings dialog's row as a card.
export const SETTING_CARD =
  'rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800';

// The icon tile that leads each row of the access card (a lock, a person, an at sign).
export const SETTING_ICON_TILE =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-700/70 dark:text-slate-300';

export const SECTION_LABEL =
  'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

// A pass's bin: bordered like its hand-over buttons beside it, rose on hover.
export const PASS_BIN =
  'inline-flex items-center rounded-md border border-slate-200 px-1.5 py-1 text-slate-500 transition duration-micro hover:border-rose-300 hover:text-rose-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-rose-400/60 dark:hover:text-rose-300';

export type ShareTab = { id: string; name: string };

// The dialog's tabs: its passes, the host's (livediagram's Community) and, for an Editor where the editor offers
// approvals, Approval (approvals.md); and, for an item in a team, Team first (one-explorer-contracts.md "Sharing and access").
export type ShareView = 'team' | 'passes' | 'app' | 'approval';

// '' stands for every tab: All tabs (All Pages on liveknowledge, scopeWords), then each tab by name in order.
export function ScopeOptions({ tabs, all = 'All tabs' }: { tabs: ShareTab[]; all?: string }) {
  return (
    <>
      <option value="">{all}</option>
      {tabs.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </>
  );
}
