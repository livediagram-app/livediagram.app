'use client';

// The Details view's cells. Each says its value in words (an icon beside it only helps), its fuller form in its title:
// a chip in the app's colour for the type, "Can edit" for access, "2 hours ago" for the last change. A cell with no
// value is a dash, named for assistive technology.

import type { ReactNode } from 'react';
import type { ShownItem } from '../../data/overlay';
import type { App, Level } from '@liveworkspace/index-client';
import { EyeIcon, FolderSolidIcon, Glyph, PencilLineIcon, VoteIcon } from '../../ui/icons';
import { siteOf } from '../../words';
import { AppMark } from '../badges';
import type { DetailsColumn } from './details-columns';
import {
  formatAgo,
  formatBytes,
  formatDate,
  formatDateTime,
  formatObjects,
  formatSize,
} from './details-format';

// Hides a column below the list's width that shows it: container queries on the list (DetailsView's `@container`),
// since the pane's width, not the window's, is what the columns share. Literal strings, so Tailwind generates them.
export const SHOWN_FROM_CLASS: Record<DetailsColumn['shownFrom'], string> = {
  always: 'flex',
  sm: 'hidden @xl:flex',
  md: 'hidden @3xl:flex',
  lg: 'hidden @5xl:flex',
};

export const ALIGN_CLASS: Record<DetailsColumn['align'], string> = {
  start: 'justify-start text-left',
  end: 'justify-end text-right',
};

export const NOT_COUNTED = 'Not counted yet';

// A cell's words: small, quiet, never wrapping.
const WORDS = 'truncate whitespace-nowrap text-xs text-slate-600 dark:text-slate-300';

export function NoValue({ label }: { label: string }) {
  return (
    <span title={label} className="text-xs text-slate-400 dark:text-slate-500">
      <span aria-hidden>–</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** What the item is: its app's logo and its kind ("Plan", "Canvas"). */
export function TypeCell({ app, label }: { app: App; label: string }) {
  return (
    <span
      title={`${label} in ${siteOf(app).name}`}
      className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pr-2 pl-1.5 text-xs font-medium text-slate-700 dark:bg-slate-700/60 dark:text-slate-200"
    >
      <span aria-hidden className="inline-flex">
        <AppMark app={app} size={12} />
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}

export function FolderTypeCell() {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-amber-50 py-0.5 pr-2 pl-1.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
      <span aria-hidden className="inline-flex shrink-0 text-amber-500 [&_svg]:size-3.5">
        <FolderSolidIcon />
      </span>
      Folder
    </span>
  );
}

const BUBBLE = 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z';

/** A speech bubble and the count ("3"), named in full ("3 comments"). Nothing for none; a dash before the app has
 *  counted. */
export function CommentsCell({ count }: { count: number | undefined }) {
  if (count === undefined) return <NoValue label={NOT_COUNTED} />;
  if (count === 0) return null;
  const label = `${count} ${count === 1 ? 'comment' : 'comments'}`;
  return (
    <span title={label} className={`inline-flex items-center gap-1.5 tabular-nums ${WORDS}`}>
      <Glyph size={14} units={24} className="shrink-0 text-slate-400 dark:text-slate-500">
        <path d={BUBBLE} />
      </Glyph>
      <span aria-hidden>{count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

const ACCESS: Record<
  Level,
  { word: string; title: string; Icon: (p: { size?: number }) => ReactNode }
> = {
  edit: { word: 'Can edit', title: 'You can edit it', Icon: PencilLineIcon },
  participate: { word: 'Can comment', title: 'You can comment and vote', Icon: VoteIcon },
  view: { word: 'Can view', title: 'You can view it', Icon: EyeIcon },
};

/** What the person may do with it, in words beside its icon. */
export function AccessCell({ level }: { level: Level }) {
  const { word, title, Icon } = ACCESS[level];
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 ${WORDS}`}>
      <span aria-hidden className="inline-flex shrink-0 text-slate-400 dark:text-slate-500">
        <Icon size={13} />
      </span>
      {word}
    </span>
  );
}

export function SizeCell({ item }: { item: Pick<ShownItem, 'summary'> }) {
  const { bytes, elements } = item.summary;
  if (typeof bytes !== 'number') return <NoValue label={NOT_COUNTED} />;
  const full = formatSize({ bytes, elements: typeof elements === 'number' ? elements : undefined });
  return (
    <span title={full} className={`tabular-nums ${WORDS}`}>
      {typeof elements === 'number' ? formatObjects(elements) : formatBytes(bytes)}
    </span>
  );
}

/** A date: how long ago (`ago`, the Updated column) or the day (Created), the exact time in its title. */
export function DateCell({ at, ago = false }: { at: number | undefined; ago?: boolean }) {
  if (at === undefined) return <NoValue label="Not known" />;
  return (
    <time dateTime={new Date(at).toISOString()} title={formatDateTime(at)} className={WORDS}>
      {ago ? formatAgo(at) : formatDate(at)}
    </time>
  );
}
