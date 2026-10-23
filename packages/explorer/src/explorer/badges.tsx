'use client';

// The marks an item carries in rows, cards and its menu header (liveplanner's project-badges.tsx): the
// visibility badge (Shared, Team, Private), the favourite star, the folder chip, the item's tags, and, in
// the All filter, which app it belongs to.

import { memo, type MouseEvent } from 'react';
import type { App, Item, Tag } from '@liveworkspace/index-client';
import {
  FolderOutlineIcon,
  PrivateBadgeGlyph,
  SharedDotGlyph,
  StarIcon,
  TeamBadgeGlyph,
} from '../ui/icons';
import { kindWords, siteOf } from '../words';

const BADGE =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1';

export function VisibilityBadge({ item }: { item: Pick<Item, 'sharedVia' | 'teamId'> }) {
  if (item.sharedVia) {
    return (
      <span
        title="Shared: you reach it through a link."
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

// A standard tag colour's ink (liveplanner's pen colours, light appearance); a custom one is its own hex.
const TAG_HEX: Record<string, string> = {
  ink: '#1e293b',
  grey: '#64748b',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  teal: '#14b8a6',
  blue: '#3b82f6',
  violet: '#8b5cf6',
  pink: '#ec4899',
};

export function tagHex(colour: string): string {
  return /^#[0-9a-f]{6}$/i.test(colour) ? colour.toLowerCase() : (TAG_HEX[colour] ?? TAG_HEX.grey!);
}

export function TagDot({ colour, size = 8 }: { colour: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: tagHex(colour) }}
    />
  );
}

export function TagChip({
  tag,
  onOpen,
  size = 'sm',
}: {
  tag: Tag;
  onOpen?: () => void;
  size?: 'sm' | 'md';
}) {
  const hex = tagHex(tag.colour);
  const className = `inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border font-medium text-slate-700 dark:text-slate-200 ${
    size === 'md'
      ? 'max-w-[16rem] px-2.5 py-0.5 text-[13px] leading-5'
      : 'max-w-[9rem] px-1.5 py-px text-[11px] leading-4'
  }`;
  const style = { background: `${hex}1f`, borderColor: `${hex}59` };
  const body = (
    <>
      <TagDot colour={tag.colour} size={size === 'md' ? 9 : 7} />
      <span className="truncate">{tag.name}</span>
    </>
  );
  if (!onOpen) {
    return (
      <span className={className} style={style}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`${className} transition hover:brightness-95`}
      style={style}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen();
      }}
    >
      {body}
    </button>
  );
}

// At most two chips on a row, then "+n" (liveplanner's ROW_CHIP_MAX).
const ROW_CHIP_MAX = 2;

export function ItemTags({
  tagIds,
  byId,
  onOpen,
}: {
  tagIds: string[];
  byId: Map<string, Tag>;
  onOpen?: (tagId: string) => void;
}) {
  if (tagIds.length === 0) return null;
  const tags = tagIds.map((id) => byId.get(id)).filter((t): t is Tag => Boolean(t));
  if (tags.length === 0) return null;
  const shown = tags.slice(0, ROW_CHIP_MAX);
  const rest = tags.length - shown.length;
  return (
    <span className="flex min-w-0 items-center gap-1">
      {shown.map((t) => (
        <TagChip key={t.id} tag={t} onOpen={onOpen ? () => onOpen(t.id) : undefined} />
      ))}
      {rest > 0 ? (
        <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">+{rest}</span>
      ) : null}
    </span>
  );
}
