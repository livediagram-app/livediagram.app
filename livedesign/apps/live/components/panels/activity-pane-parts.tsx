'use client';

// The Inbox's building blocks (docs/specs/013-workspace/inbox.md §1): a titled section
// of rows, the three row kinds, and the page's empty + failed states.
// Lifted out of ActivityPane so the pane file keeps the data split and
// the section order, and each piece here is one cohesive slice.

import { InboxIcon, TeamIcon } from '@/components/primitives/explorer-icons';
import { CountBadge, IDENTITY_FILL, identityVars } from '@livedesign/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ActivityAction, ActivityPlace, ActivityThread } from '@livedesign/api-schema';
import {
  EmptyState,
  HoverCard,
  SOLID_BRAND_DARK,
  SOLID_BRAND_DARK_CONTROL,
  GlyphDisc,
} from '@livedesign/ui';
import { ActionMenuIcon, CommentMenuIcon } from '@/components/palette/context-menu-icons';
import { ThisBrowserPill } from '@/components/primitives/ThisBrowserPill';
import type { Located } from '@/app/explorer/useActivityFeed';
import { collabDeepLinkHref } from '@/lib/collab-deep-link';
import { helpArticleHref } from '@/lib/help-articles';
import { initialsOf } from '@/lib/identity';
import { formatRelativeTimeShort, useRelativeNow } from '@/lib/relative-time';
import { LIST_CARD } from '@/components/primitives/surface-classes';

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
      <div className={LIST_CARD}>
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
  action: Located<ActivityAction>;
  onOpen: () => void;
}) {
  const assignee = action.assignedToMe ? 'You' : action.assignee.name?.trim() || 'Teammate';
  return (
    <ActivityRowShell
      href={collabDeepLinkHref(action, 'action')}
      place={action}
      onOpen={onOpen}
      icon={<ActionMenuIcon />}
      title={action.name}
      detail={action.description || null}
      avatar={{
        name: assignee,
        detail: action.assignedToMe
          ? `Assigned by ${action.assigner.name?.trim() || 'a teammate'}`
          : `Assigned to ${assignee}`,
        colorClass: action.assignedToMe
          ? `bg-brand-700 ${SOLID_BRAND_DARK}`
          : 'bg-slate-400 dark:bg-slate-600',
      }}
      at={action.updatedAt}
    />
  );
}

// What a thread row says about why it is on the page: a mention is the most
// direct reason, so it wins (docs/specs/012-collaboration/comment-mentions.md "The Inbox").
type ThreadFacts = Pick<
  ActivityThread,
  'mentionsYou' | 'onYourDesign' | 'youCommented' | 'commentCount' | 'latest'
>;

function threadHint(t: ThreadFacts): string | null {
  if (t.mentionsYou) return 'Mentioned You';
  return t.onYourDesign && !t.youCommented ? 'Your design' : null;
}

function threadAvatar(t: ThreadFacts) {
  return {
    name: t.latest.authorName,
    detail:
      t.commentCount === 1
        ? '1 comment in this thread'
        : `${t.commentCount} comments in this thread`,
    color: t.latest.authorColor,
  };
}

export function ActivityThreadRow({
  thread,
  onOpen,
}: {
  thread: Located<ActivityThread>;
  onOpen: () => void;
}) {
  return (
    <ActivityRowShell
      href={collabDeepLinkHref(thread, 'comments')}
      place={thread}
      onOpen={onOpen}
      icon={<CommentMenuIcon />}
      title={thread.elementLabel}
      detail={thread.latest.text}
      hint={threadHint(thread)}
      avatar={threadAvatar(thread)}
      at={thread.latest.at}
    />
  );
}

// The shared row: kind glyph far left, title + detail in the middle
// with the "where" line under them, avatar-over-time far right. The
// whole row is one link into the editor (docs/specs/013-workspace/inbox.md §1).
function ActivityRowShell({
  href,
  place,
  onOpen,
  icon,
  title,
  detail,
  hint,
  avatar,
  at,
}: {
  href: string;
  place: Located<ActivityPlace>;
  onOpen: () => void;
  icon: ReactNode;
  title: string;
  detail: string | null;
  hint?: string | null;
  avatar: { name: string; detail: string; colorClass?: string; color?: string };
  at: number;
}) {
  const now = useRelativeNow();
  return (
    <li>
      <Link
        href={href}
        onClick={onOpen}
        className="group flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        <span aria-hidden className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-400">
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
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <PlaceChip place={place} />
            <span className="truncate">{`${place.elementLabel} · ${place.tabName}`}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <HoverCard title={avatar.name} description={avatar.detail}>
            <GlyphDisc
              size={24}
              className={`text-[9px] font-semibold text-white ${avatar.colorClass ?? ''} ${avatar.color ? IDENTITY_FILL : ''}`}
              style={avatar.color ? identityVars(avatar.color) : undefined}
            >
              {initialsOf(avatar.name)}
            </GlyphDisc>
          </HoverCard>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {formatRelativeTimeShort(now - at)}
          </span>
        </span>
      </Link>
    </li>
  );
}

// Which design the row is from; a team design's chip leads with the
// team glyph so the source of the work reads at a glance. When the design is in This Browser, the chip is followed by
// the This Browser pill, as a label since the whole row is a link (docs/specs/006-design/offline-mode.md#this-browser-pill).
// `local` is set when the design is saved only in this browser (docs/specs/013-workspace/inbox.md §2.6).
function PlaceChip({ place }: { place: Located<ActivityPlace> }) {
  return (
    <>
      <DesignChip place={place} />
      {place.local ? <ThisBrowserPill asLabel /> : null}
    </>
  );
}

function DesignChip({ place }: { place: Located<ActivityPlace> }) {
  return (
    <span className="inline-flex max-w-[14rem] shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
      {place.via === 'team' ? (
        <span aria-hidden className="text-slate-400">
          <TeamIcon />
        </span>
      ) : null}
      <span className="truncate">{place.designName}</span>
    </span>
  );
}

// Nothing outstanding anywhere. No New Design CTA: a new design puts
// nothing on this page; assigning an action or commenting does.
export function ActivityEmptyState({ compact = false }: { compact?: boolean } = {}) {
  return (
    <EmptyState
      compact={compact}
      icon={<InboxIcon />}
      title="Nothing waiting on you"
      description="Open actions assigned to you, actions you assigned, and comment threads you're in, collect here across every design."
    >
      <a
        href={helpArticleHref('assignedActions')}
        target="_blank"
        rel="noreferrer noopener"
        className={`inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL}`}
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
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={`mt-3 inline-block rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL}`}
      >
        Try again
      </button>
    </div>
  );
}
