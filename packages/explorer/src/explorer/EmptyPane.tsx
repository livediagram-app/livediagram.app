'use client';

// What a view says when it has nothing (liveplanner's ExplorerEmptyState), in the list's own words.

import type { ReactNode } from 'react';
import { EmptyState } from '../ui/EmptyState';
import { FOCUS_RING, SOLID_BRAND_DARK_CONTROL } from '../ui/classes';
import {
  ClockIcon,
  FolderSolidIcon,
  InboxIcon,
  PlusIcon,
  MyWorkIcon,
  SearchIcon,
  ShareIcon,
  StarIcon,
  TeamIcon,
  TimelineIcon,
  TrashIcon,
  UnsortedIcon,
} from '../ui/icons';
import { ImageIcon, MailIcon, ShapesIcon } from '../ui/library-icons';
import type { ExplorerView } from '../views';
import type { Words } from '../words';
import { BrowserIcon } from './host';

export function emptyCopy(
  view: ExplorerView,
  w: Words,
): { icon: ReactNode; title: string; description: string; cta: boolean } {
  switch (view.kind) {
    case 'all':
      return {
        icon: <MyWorkIcon />,
        title: `No ${w.lowerMany} yet`,
        description: `Create your first ${w.lowerOne} and it will appear here.`,
        cta: true,
      };
    case 'unsorted':
      return {
        icon: <UnsortedIcon />,
        title: 'Nothing unsorted',
        description: `Every ${w.lowerOne} is in a folder.`,
        cta: false,
      };
    case 'recent':
      return {
        icon: <ClockIcon />,
        title: `No recent ${w.lowerMany}`,
        description: `${w.many} show up here as you open them, newest first. Make your first one.`,
        cta: true,
      };
    case 'favourites':
      return {
        icon: <StarIcon />,
        title: 'No favourites yet',
        description: `Mark a ${w.lowerOne} as a favourite to show it here.`,
        cta: false,
      };
    case 'shared':
      return {
        icon: <ShareIcon />,
        title: 'Nothing shared with you yet',
        description: `Open a share link someone sends you and the ${w.lowerOne} lands here.`,
        cta: false,
      };
    case 'trash':
      return {
        icon: <TrashIcon />,
        title: 'Nothing in the Trash right now',
        description: `Delete a ${w.lowerOne} and it is kept here for 30 days, so you can restore it.`,
        cta: false,
      };
    case 'inbox':
      return {
        icon: <InboxIcon />,
        title: 'Nothing waiting on you',
        description: `Open actions and cards assigned to you, actions you assigned, new form responses and comment threads you’re in collect here, across every ${w.lowerOne}.`,
        cta: false,
      };
    case 'timeline':
      return {
        icon: <TimelineIcon />,
        title: 'Nothing has happened yet',
        description: `What you and your teams do to ${w.lowerMany} lands here: made, renamed, moved, shared, edited.`,
        cta: true,
      };
    case 'search':
      return view.q
        ? {
            icon: <SearchIcon />,
            title: `Nothing matches “${view.q}”`,
            description: 'Search looks at names and folders.',
            cta: false,
          }
        : {
            icon: <SearchIcon />,
            title: 'Search everything',
            description: `Type to find ${w.lowerMany} by name or folder, or filter them: made-by:ai, edited:7d.`,
            cta: false,
          };
    case 'folder':
      return {
        icon: <FolderSolidIcon open />,
        title: 'This folder is empty',
        description: `Add a ${w.lowerOne} or a subfolder to organise your work.`,
        cta: true,
      };
    case 'team':
      return {
        icon: <TeamIcon />,
        title: `No team ${w.lowerMany} yet`,
        description: `${w.many} here are open to everyone in the team.`,
        cta: true,
      };
    case 'invites':
      return {
        icon: <MailIcon />,
        title: 'No pending invites',
        description: 'Sign in to see the team invitations waiting for you.',
        cta: false,
      };
    case 'gallery':
      return {
        icon: <ImageIcon />,
        title: 'No images yet',
        description: `Every image you add to a ${w.lowerOne} collects here, ready to reuse in any of them.`,
        cta: false,
      };
    case 'shape-libraries':
      return {
        icon: <ShapesIcon />,
        title: 'No shape libraries yet',
        description: 'Import a draw.io library and its shapes collect here.',
        cta: false,
      };
    case 'offline':
      return {
        icon: <BrowserIcon />,
        title: 'Nothing kept only in this browser',
        description: `${w.many} you keep only in this browser show up here.`,
        cta: false,
      };
    case 'home':
      return {
        icon: <ClockIcon />,
        title: `No ${w.lowerMany} yet`,
        description: `The ${w.lowerMany} you open will gather here.`,
        cta: true,
      };
  }
}

/** livediagram's empty-state call to action: a solid brand button with a plus. */
export const EMPTY_CTA = `inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL} ${FOCUS_RING}`;

export function EmptyPane({
  view,
  words,
  onCreate,
  createLabel,
  children,
  compact = false,
}: {
  view: ExplorerView;
  compact?: boolean;
  words: Words;
  /** New, offered where the view's words call for it. */
  onCreate?: () => void;
  createLabel?: string;
  children?: ReactNode;
}) {
  const copy = emptyCopy(view, words);
  return (
    <EmptyState
      icon={copy.icon}
      title={copy.title}
      description={copy.description}
      compact={compact}
    >
      {copy.cta && onCreate ? (
        <button type="button" onClick={onCreate} className={EMPTY_CTA}>
          <PlusIcon size={14} />
          {createLabel ?? `New ${words.one}`}
        </button>
      ) : null}
      {children}
    </EmptyState>
  );
}

export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {Array.from({ length: count }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="h-4 w-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <span className="h-4 flex-1 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <span className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </li>
        ))}
      </ul>
    </div>
  );
}
