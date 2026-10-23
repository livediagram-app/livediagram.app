'use client';

// What a view says when it has nothing (liveplanner's ExplorerEmptyState), in the list's own words.

import type { ReactNode } from 'react';
import { EmptyState } from '../ui/EmptyState';
import {
  ClockIcon,
  FolderSolidIcon,
  InboxIcon,
  MyWorkIcon,
  SearchIcon,
  ShareIcon,
  StarIcon,
  TagIcon,
  TeamIcon,
  TrashIcon,
  UnsortedIcon,
} from '../ui/icons';
import type { ExplorerView } from '../views';
import type { Words } from '../words';

export function emptyCopy(
  view: ExplorerView,
  w: Words,
): { icon: ReactNode; title: string; description: string } {
  switch (view.kind) {
    case 'all':
      return {
        icon: <MyWorkIcon />,
        title: `No ${w.lowerMany} yet`,
        description: `Make your first ${w.lowerOne}, or a folder to keep them in.`,
      };
    case 'unsorted':
      return {
        icon: <UnsortedIcon />,
        title: 'Nothing unsorted',
        description: `Every ${w.lowerOne} is in a folder.`,
      };
    case 'recent':
      return {
        icon: <ClockIcon />,
        title: 'Nothing opened yet',
        description: `${w.many} you open show here, latest first.`,
      };
    case 'favourites':
      return {
        icon: <StarIcon />,
        title: 'No favourites yet',
        description: `Star a ${w.lowerOne} from its menu to keep it here.`,
      };
    case 'shared':
      return {
        icon: <ShareIcon />,
        title: 'Nothing shared with you yet',
        description: `${w.many} you open through someone’s link show here.`,
      };
    case 'tags':
      return {
        icon: <TagIcon />,
        title: view.id ? `No ${w.lowerMany} with this tag` : 'No tags yet',
        description: view.id
          ? `Tag a ${w.lowerOne} from its menu to list it here.`
          : `Make a tag from a ${w.lowerOne}’s menu.`,
      };
    case 'trash':
      return {
        icon: <TrashIcon />,
        title: 'The Trash is empty',
        description: 'Deleted items stay here for 30 days, then go for good.',
      };
    case 'inbox':
      return {
        icon: <InboxIcon />,
        title: 'You’re all caught up',
        description: 'Actions for you and threads you’re in show here.',
      };
    case 'search':
      return view.q
        ? {
            icon: <SearchIcon />,
            title: `Nothing matches “${view.q}”`,
            description: 'Search looks at names, tags and folders.',
          }
        : {
            icon: <SearchIcon />,
            title: 'Search everything',
            description: `Type to find ${w.lowerMany} by name, tag or folder.`,
          };
    case 'folder':
      return {
        icon: <FolderSolidIcon />,
        title: 'This folder is empty',
        description: `Make a ${w.lowerOne} here, or move one in from its menu.`,
      };
    case 'team':
      return {
        icon: <TeamIcon />,
        title: `No team ${w.lowerMany} yet`,
        description: `${w.many} here are open to everyone in the team.`,
      };
    case 'home':
      return {
        icon: <ClockIcon />,
        title: 'Nothing to jump back into',
        description: `${w.many} you open show here.`,
      };
  }
}

export function EmptyPane({
  view,
  words,
  children,
}: {
  view: ExplorerView;
  words: Words;
  children?: ReactNode;
}) {
  const copy = emptyCopy(view, words);
  return (
    <EmptyState icon={copy.icon} title={copy.title} description={copy.description}>
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
