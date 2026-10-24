'use client';

// The Inbox (one-explorer-contracts.md "Inbox"): what is outstanding for the person, across every app or this one
// (the header's filter). Assigned to You (actions and cards), Assigned by You, Form Responses and Open Comment
// Threads, each hidden when empty, one empty state when all are. Rows are in ./inbox/InboxRows; the split in
// ./inbox/sections.

import { useEffect, useRef, type ReactNode } from 'react';
import { CountBadge } from '@liveworkspace/ui';
import { LIST_CARD } from '../ui/classes';
import { EMPTY_CTA, EmptyPane, SkeletonRows } from './EmptyPane';
import { useExplorer } from './context';
import { InboxActionRow, InboxFormRow, InboxThreadRow } from './inbox/InboxRows';
import { inboxSections } from './inbox/sections';
import { PaneHeader } from './PaneHeader';

// `compact`: inside the editor's Explorer panel, under the pane's own header, with the small empty state.
export function InboxPane({
  onOpenNav,
  compact = false,
}: {
  onOpenNav?: () => void;
  compact?: boolean;
}) {
  const { inbox, inboxHost, viewerId, words, filter } = useExplorer();
  const onTelemetry = inboxHost?.onTelemetry;
  // `Activity / Opened` once per visit, through the host's hook as it is when the Inbox opens: not per read
  // (returning to the tab re-reads, which is not a visit), nor when the filter or the host's props change.
  const telemetry = useRef(onTelemetry);
  telemetry.current = onTelemetry;
  useEffect(() => {
    telemetry.current?.('Opened');
  }, []);
  const { forMe, byMe, forms, threads } = inboxSections(inbox.data, viewerId);
  const showApp = filter === 'all';
  const retry = () => {
    onTelemetry?.('Loaded', 'Retry');
    inbox.reload();
  };
  const help = inboxHost?.actionsHelpHref;
  return (
    <div data-explorer-view="inbox">
      {compact ? null : <PaneHeader title="Inbox" onOpenNav={onOpenNav} />}
      {inbox.error ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Couldn’t load your Inbox
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Check your connection and try again.
          </p>
          <button type="button" onClick={retry} className={`mt-3 ${EMPTY_CTA}`}>
            Try again
          </button>
        </div>
      ) : inbox.loading ? (
        <SkeletonRows count={4} />
      ) : forMe.length + byMe.length + forms.length + threads.length === 0 ? (
        <EmptyPane view={{ kind: 'inbox' }} words={words} compact={compact}>
          {help ? (
            <a href={help} target="_blank" rel="noreferrer noopener" className={EMPTY_CTA}>
              How actions work
            </a>
          ) : null}
        </EmptyPane>
      ) : (
        <div className="flex flex-col gap-5">
          <InboxSection title="Assigned to You" count={forMe.length}>
            {forMe.map((r) => (
              <InboxActionRow key={`a:${r.itemId}:${r.actionId}`} row={r} forMe showApp={showApp} />
            ))}
          </InboxSection>
          <InboxSection title="Assigned by You" count={byMe.length}>
            {byMe.map((r) => (
              <InboxActionRow
                key={`a:${r.itemId}:${r.actionId}`}
                row={r}
                forMe={false}
                showApp={showApp}
              />
            ))}
          </InboxSection>
          <InboxSection title="Form Responses" count={forms.length}>
            {forms.map((r) => (
              <InboxFormRow key={`f:${r.itemId}:${r.tabId}`} row={r} showApp={showApp} />
            ))}
          </InboxSection>
          <InboxSection title="Open Comment Threads" count={threads.length}>
            {threads.map((r) => (
              <InboxThreadRow
                key={`t:${r.itemId}:${r.tabId}:${r.elementId}`}
                row={r}
                showApp={showApp}
              />
            ))}
          </InboxSection>
        </div>
      )}
    </div>
  );
}

function InboxSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section aria-label={title}>
      <h2 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
        <CountBadge count={count} />
      </h2>
      <ul className={`${LIST_CARD} divide-y divide-slate-100 dark:divide-slate-700/60`}>
        {children}
      </ul>
    </section>
  );
}
