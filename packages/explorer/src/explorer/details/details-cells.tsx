'use client';

// The Details view's cells. Icon cells carry no words on screen: each is named in its title and, visually
// hidden, for assistive technology. A cell with no value is a dash, named the same way.

import type { ReactNode } from 'react';
import type { Level } from '@liveworkspace/index-client';
import type { ShownItem } from '../../data/overlay';
import {
  EyeIcon,
  FolderSolidIcon,
  Glyph,
  ItemIcon,
  PencilLineIcon,
  VoteIcon,
} from '../../ui/icons';
import type { DetailsColumn } from './details-columns';
import { formatDateTime, formatSize } from './details-format';

// Hides a column below the width that shows it. Literal class strings, so Tailwind generates them.
export const SHOWN_FROM_CLASS: Record<DetailsColumn['shownFrom'], string> = {
  always: '',
  sm: 'hidden sm:flex',
  md: 'hidden md:flex',
  lg: 'hidden lg:flex',
};

export const ALIGN_CLASS: Record<DetailsColumn['align'], string> = {
  start: 'justify-start text-left',
  center: 'justify-center text-center',
  end: 'justify-end text-right',
};

export const NOT_COUNTED = 'Not counted yet';

function NamedIcon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span title={label} className="inline-flex items-center justify-center">
      {children}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function NoValue({ label }: { label: string }) {
  return (
    <span title={label} className="text-slate-500 dark:text-slate-400">
      <span aria-hidden>–</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function TypeCell({ label }: { label: string }) {
  return (
    <NamedIcon label={label}>
      <span aria-hidden className="inline-flex text-slate-500 dark:text-slate-400">
        <ItemIcon size={14} />
      </span>
    </NamedIcon>
  );
}

export function FolderTypeCell() {
  return (
    <NamedIcon label="Folder">
      <span aria-hidden className="inline-flex text-amber-500">
        <FolderSolidIcon />
      </span>
    </NamedIcon>
  );
}

// Above this the bubble reads "99+".
export const COMMENTS_SHOWN_MAX = 99;
const BUBBLE = 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z';

/** A speech bubble holding the count, drawn as one icon. Nothing for none; a dash before the app has counted. */
export function CommentsCell({ count }: { count: number | undefined }) {
  if (count === undefined) return <NoValue label={NOT_COUNTED} />;
  if (count === 0) return null;
  const label = `${count} ${count === 1 ? 'comment' : 'comments'}`;
  const shown = count > COMMENTS_SHOWN_MAX ? `${COMMENTS_SHOWN_MAX}+` : String(count);
  const fontSize = shown.length > 2 ? 7 : 9;
  return (
    <NamedIcon label={label}>
      <Glyph size={24} units={24} className="text-slate-300 dark:text-slate-600">
        <path d={BUBBLE} />
        <text
          x={12}
          y={10 + (0.72 * fontSize) / 2}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight={600}
          stroke="none"
          className="fill-slate-600 tabular-nums dark:fill-slate-300"
        >
          {shown}
        </text>
      </Glyph>
    </NamedIcon>
  );
}

const ACCESS: Record<Level, { title: string; Icon: (p: { size?: number }) => ReactNode }> = {
  edit: { title: 'Can edit', Icon: PencilLineIcon },
  participate: { title: 'Can participate', Icon: VoteIcon },
  view: { title: 'Can view', Icon: EyeIcon },
};

/** The person's level on the item, small and muted. */
export function AccessCell({ level }: { level: Level }) {
  const { title, Icon } = ACCESS[level];
  return (
    <NamedIcon label={title}>
      <span aria-hidden className="inline-flex text-slate-500 dark:text-slate-400">
        <Icon size={12} />
      </span>
    </NamedIcon>
  );
}

export function SizeCell({ item }: { item: Pick<ShownItem, 'summary'> }) {
  const { bytes, elements } = item.summary;
  if (typeof bytes !== 'number') return <NoValue label={NOT_COUNTED} />;
  return (
    <span className="truncate whitespace-nowrap text-xs tabular-nums text-slate-600 dark:text-slate-300">
      {formatSize({ bytes, elements: typeof elements === 'number' ? elements : undefined })}
    </span>
  );
}

export function DateCell({ at }: { at: number | undefined }) {
  if (at === undefined) return <NoValue label="Not known" />;
  return (
    <span className="truncate whitespace-nowrap text-xs tabular-nums text-slate-600 dark:text-slate-300">
      {formatDateTime(at)}
    </span>
  );
}
