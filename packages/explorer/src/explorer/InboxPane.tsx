'use client';

// The Inbox (liveplanner's ActivityPane rows over GET /inbox): open actions for the person and unresolved
// threads they are in, across every app. Each row links to its app, item, tab and element through the
// host's itemHref, so a row from another app opens there.

import { memo } from 'react';
import { APP_KINDS, type InboxAction, type InboxThread } from '@liveworkspace/index-client';
import { RelativeTimeChip } from '../ui/RelativeTimeChip';
import { LIST_CARD, MUTED } from '../ui/classes';
import { ActionIcon, CommentIcon } from '../ui/icons';
import { kindWords } from '../words';
import { AppMark } from './badges';
import { useExplorer } from './context';
import { EmptyPane, SkeletonRows } from './EmptyPane';
import { PaneHeader } from './PaneHeader';

// `compact`: inside the editor's Explorer panel, under the pane's own header, with the small empty state.
export function InboxPane({ onOpenNav, compact = false }: { onOpenNav?: () => void; compact?: boolean }) {
  const { inbox, viewerId, words, filter } = useExplorer();
  const data = inbox.data;
  const forMe = data
    ? data.actions.filter((a) => a.status === 'open' && (!viewerId || a.assigneeId === viewerId))
    : [];
  const byMe = data
    ? data.actions.filter(
        (a) =>
          a.status === 'open' && viewerId && a.assignerId === viewerId && a.assigneeId !== viewerId,
      )
    : [];
  const threads = data ? data.threads.filter((t) => !t.resolved) : [];
  const showApp = filter === 'all';
  return (
    <div data-explorer-view="inbox">
      {compact ? null : <PaneHeader title="Inbox" onOpenNav={onOpenNav} />}
      {inbox.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          Couldn’t load your Inbox.{' '}
          <button type="button" className="font-semibold underline" onClick={inbox.reload}>
            Try again
          </button>
        </div>
      ) : inbox.loading ? (
        <SkeletonRows count={4} />
      ) : forMe.length + byMe.length + threads.length === 0 ? (
        <EmptyPane view={{ kind: 'inbox' }} words={words} compact={compact} />
      ) : (
        <div className="flex flex-col gap-6">
          <InboxSection title="Assigned to You" rows={forMe} showApp={showApp} />
          <InboxSection title="Assigned by You" rows={byMe} showApp={showApp} />
          <InboxSection title="Threads" rows={threads} showApp={showApp} />
        </div>
      )}
    </div>
  );
}

function InboxSection({
  title,
  rows,
  showApp,
}: {
  title: string;
  rows: (InboxAction | InboxThread)[];
  showApp: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        {title} <span className="tabular-nums">({rows.length})</span>
      </h2>
      <ul className={`${LIST_CARD} divide-y divide-slate-100 dark:divide-slate-700/60`}>
        {rows.map((r) => (
          <InboxRow
            key={
              'actionId' in r
                ? `a:${r.itemId}:${r.actionId}`
                : `t:${r.itemId}:${r.tabId}:${r.elementId}`
            }
            row={r}
            showApp={showApp}
          />
        ))}
      </ul>
    </section>
  );
}

const InboxRow = memo(function InboxRow({
  row,
  showApp,
}: {
  row: InboxAction | InboxThread;
  showApp: boolean;
}) {
  const { Link, itemHref } = useExplorer();
  const isAction = 'actionId' in row;
  const href = itemHref(
    { id: row.itemId, app: row.app, kind: APP_KINDS[row.app], sharedVia: null },
    { tabId: row.tabId, elementId: row.elementId },
  );
  const headline = isAction ? row.name : row.latestText;
  const where = `${row.itemTitle || 'Untitled'} · ${row.elementLabel || kindWords(row.app).one}`;
  const at = isAction ? row.updatedAt : row.latestAt;
  return (
    <li>
      <Link
        href={href}
        className="flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        <span className="mt-0.5 shrink-0 text-slate-400">
          {isAction ? <ActionIcon /> : <CommentIcon />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {headline || (isAction ? 'Action' : 'Comment')}
          </span>
          <span className={`flex min-w-0 items-center gap-1.5 text-xs ${MUTED}`}>
            {showApp ? <AppMark app={row.app} size={14} /> : null}
            <span className="truncate">
              {isAction
                ? where
                : `${row.latestAuthorName} · ${where} · ${row.commentCount} comments`}
            </span>
          </span>
        </span>
        <span className="shrink-0">
          <RelativeTimeChip at={at} />
        </span>
      </Link>
    </li>
  );
});
