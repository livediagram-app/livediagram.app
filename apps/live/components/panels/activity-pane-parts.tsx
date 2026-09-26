'use client';

// The Activity page's building blocks (docs/specs/013-workspace/activity-page.md §1): a titled section
// of rows, the two row kinds, and the page's empty + failed states.
// Lifted out of ActivityPane so the pane file keeps the data split and
// the section order, and each piece here is one cohesive slice.

import { ActivityIcon, TeamIcon } from '@/components/primitives/explorer-icons';
import { CountBadge } from '@/components/primitives/CountBadge';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ActivityAction, ActivityPlace, ActivityThread } from '@livediagram/api-schema';
import { EmptyState } from '@livediagram/ui';
import { ActionMenuIcon, CommentMenuIcon } from '@/components/palette/context-menu-icons';
import { Tooltip } from '@/components/primitives/Tooltip';
import { collabDeepLinkHref, type CollabPopover } from '@/lib/collab-deep-link';
import { helpArticleHref } from '@/lib/help-articles';
import { initialsOf } from '@/lib/identity';
import { formatRelativeTimeShort } from '@/lib/relative-time';

// One titled card-list. The container matches the List view's so the
// page reads as an Explorer section rather than a panel that escaped
// the editor.
export function ActivitySection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
        <CountBadge count={count} />
      </h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <ul className="lvd-cascade divide-y divide-slate-100 dark:divide-slate-700/60">
          {children}
        </ul>
      </div>
    </section>
  );
}

export function ActivityActionRow({
  action,
  onOpen,
}: {
  action: ActivityAction;
  onOpen: () => void;
}) {
  const assignee = action.assignedToMe ? 'You' : action.assignee.name?.trim() || 'Teammate';
  return (
    <ActivityRowShell
      place={action}
      open="action"
      onOpen={onOpen}
      icon={<ActionMenuIcon />}
      title={action.name}
      detail={action.description || null}
      avatar={{
        name: assignee,
        detail: action.assignedToMe
          ? `Assigned by ${action.assigner.name?.trim() || 'a teammate'}`
          : `Assigned to ${assignee}`,
        colorClass: action.assignedToMe ? 'bg-brand-500' : 'bg-slate-400 dark:bg-slate-600',
      }}
      at={action.updatedAt}
    />
  );
}

export function ActivityThreadRow({
  thread,
  onOpen,
}: {
  thread: ActivityThread;
  onOpen: () => void;
}) {
  return (
    <ActivityRowShell
      place={thread}
      open="comments"
      onOpen={onOpen}
      icon={<CommentMenuIcon />}
      title={thread.elementLabel}
      detail={thread.latest.text}
      hint={thread.onYourDiagram && !thread.youCommented ? 'Your diagram' : null}
      avatar={{
        name: thread.latest.authorName,
        detail:
          thread.commentCount === 1
            ? '1 comment in this thread'
            : `${thread.commentCount} comments in this thread`,
        color: thread.latest.authorColor,
      }}
      at={thread.latest.at}
    />
  );
}

// The shared row: kind glyph far left, title + detail in the middle
// with the "where" line under them, avatar-over-time far right. The
// whole row is one link into the editor (docs/specs/013-workspace/activity-page.md §1).
function ActivityRowShell({
  place,
  open,
  onOpen,
  icon,
  title,
  detail,
  hint,
  avatar,
  at,
}: {
  place: ActivityPlace;
  open: CollabPopover;
  onOpen: () => void;
  icon: ReactNode;
  title: string;
  detail: string | null;
  hint?: string | null;
  avatar: { name: string; detail: string; colorClass?: string; color?: string };
  at: number;
}) {
  return (
    <li>
      <Link
        href={collabDeepLinkHref(place, open)}
        onClick={onOpen}
        className="group flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        <span aria-hidden className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-900 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-300">
              {title}
            </span>
            {hint ? (
              <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                {hint}
              </span>
            ) : null}
          </span>
          {detail ? (
            <span className="mt-0.5 line-clamp-1 block text-xs text-slate-500 dark:text-slate-400">
              {detail}
            </span>
          ) : null}
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            <PlaceChip place={place} />
            <span className="truncate">
              {place.elementLabel} · {place.tabName}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <Tooltip title={avatar.name} description={avatar.detail}>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white ${avatar.colorClass ?? ''}`}
              style={avatar.color ? { backgroundColor: avatar.color } : undefined}
            >
              {initialsOf(avatar.name)}
            </span>
          </Tooltip>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {formatRelativeTimeShort(Date.now() - at)}
          </span>
        </span>
      </Link>
    </li>
  );
}

// Which diagram the row is from; a team diagram's chip leads with the
// team glyph so the source of the work reads at a glance.
function PlaceChip({ place }: { place: ActivityPlace }) {
  return (
    <span className="inline-flex max-w-[14rem] shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
      {place.via === 'team' ? (
        <span aria-hidden className="text-slate-400 dark:text-slate-500">
          <TeamIcon />
        </span>
      ) : null}
      <span className="truncate">{place.diagramName}</span>
    </span>
  );
}

// Nothing outstanding anywhere. No New Diagram CTA: a new diagram puts
// nothing on this page; assigning an action or commenting does.
export function ActivityEmptyState() {
  return (
    <EmptyState
      icon={<ActivityIcon />}
      title="Nothing waiting on you"
      description="Open actions assigned to you or by you, and comment threads you're in, collect here across every diagram."
    >
      <a
        href={helpArticleHref('assignedActions')}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
      >
        How actions work
      </a>
    </EmptyState>
  );
}

// The read failed, which is NOT "nothing outstanding".
export function ActivityFailedState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        Couldn&apos;t load your activity
      </p>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-block rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-500"
      >
        Try again
      </button>
    </div>
  );
}
