'use client';

// The marks an item carries in rows, cards and its menu header (liveplanner's project-badges.tsx): the
// visibility badge (Shared, Team, Private), Made by AI, the favourite star, the folder chip, and, in the All filter,
// which app it belongs to.

import { memo, type MouseEvent } from 'react';
import type { App, Item } from '@liveworkspace/index-client';
import {
  FolderOutlineIcon,
  PrivateBadgeGlyph,
  SharedDotGlyph,
  SparkleIcon,
  StarIcon,
  TeamBadgeGlyph,
} from '../ui/icons';
import { kindWords, siteOf } from '../words';

const BADGE =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1';

export function VisibilityBadge({
  item,
}: {
  item: Pick<Item, 'sharedVia' | 'teamId'> & { hasLinks?: boolean };
}) {
  if (item.sharedVia || item.hasLinks) {
    return (
      <span
        title={
          item.sharedVia
            ? 'Shared: you reach it through a link.'
            : 'Shared: anyone with one of its links can open it.'
        }
        className={`${BADGE} bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30`}
      >
        <SharedDotGlyph />
        Shared
      </span>
    );
  }
  if (item.teamId) {
    return (
      <span
        title="Team: every member of the team can open it."
        className={`${BADGE} bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30`}
      >
        <TeamBadgeGlyph />
        Team
      </span>
    );
  }
  return (
    <span
      title="Private: only visible to you."
      className={`${BADGE} bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700`}
    >
      <PrivateBadgeGlyph />
      Private
    </span>
  );
}

/** An item an AI tool made through MCP (its source is `ai`): what the Made by AI filter reads, shown. */
export function MadeByAiBadge({ item }: { item: Pick<Item, 'source'> }) {
  if (item.source !== 'ai') return null;
  return (
    <span
      data-made-by-ai=""
      title="Made by AI: an AI tool made it."
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30"
    >
      <SparkleIcon size={10} />
      Made by AI
    </span>
  );
}

export function FavouriteMarker() {
  return (
    <span
      title="Favourite"
      className="inline-flex shrink-0 items-center text-amber-500 dark:text-amber-400"
    >
      <StarIcon filled />
      <span className="sr-only">Favourite</span>
    </span>
  );
}

export function FolderChip({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      title={label}
      onClick={(e: MouseEvent) => {
        // The row is a link to the item; this goes to the folder instead.
        e.preventDefault();
        e.stopPropagation();
        onOpen();
      }}
      className="inline-flex max-w-[10rem] items-center gap-1 rounded px-1 py-0.5 text-[11px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
    >
      <span className="shrink-0 [&_svg]:h-3 [&_svg]:w-3">
        <FolderOutlineIcon />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * Which app an item belongs to, in its app's accent: a small square mark with the app's initial, and its
 * kind word for a screen reader. Shown on every row while the filter is All.
 */
export const AppMark = memo(function AppMark({ app, size = 16 }: { app: App; size?: number }) {
  const site = siteOf(app);
  const word = kindWords(app).one;
  return (
    <span
      data-app-mark={app}
      title={`${word} in ${site.name}`}
      className="inline-flex shrink-0 items-center justify-center rounded font-bold leading-none text-white"
      style={{
        width: size,
        height: size,
        background: site.accent,
        fontSize: Math.round(size * 0.6),
      }}
    >
      <span aria-hidden>{site.name.replace(/^live/, '').charAt(0).toUpperCase()}</span>
      <span className="sr-only">{`${word} in ${site.name}`}</span>
    </span>
  );
});
