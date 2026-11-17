'use client';

// Walkthroughs in the footer's Tools (each canvas app's docs/specs/012-collaboration/walkthroughs.md "In Tools";
// liveworkspace/docs/specs/004-index/footer-tools-menu.md): one row under Collaborate, published through the Tools
// door, with the count of recorded walkthroughs at its end. Pressing it opens the Walkthroughs panel from the Tools
// button, as Tools itself opens: the item's walkthroughs to play, each with its delete where the caller may, and
// Record Walkthrough for an Editor. No row where walkthroughs don't fit (a phone, an embed, This Browser, a tab-scoped
// link) or where there is nothing to play or record.

import type { WalkthroughSummary } from '@liveworkspace/media/walkthrough';
import {
  CompactEmptyState,
  ConfirmPopover,
  CountBadge,
  HoverCard,
  Spinner,
  TrashIcon,
  formatRelativeTime,
} from '@liveworkspace/ui';
import type { ChromeToolsItem } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import { usePublishToolsItems } from '@liveworkspace/workbench/components/chrome/tools-door';
import { PopoverOrSheet } from '@liveworkspace/workbench/components/primitives/PopoverOrSheet';
import { useMemo, useState } from 'react';
import { formatClock } from '../timeline';
import type { WalkthroughsMenu } from '../useWalkthroughs';
import { PlayIcon, RecordIcon, WalkthroughIcon } from './icons';

const PANEL_WIDTH = 360;

export function WalkthroughsTools({ menu }: { menu: WalkthroughsMenu }) {
  // The Tools button the panel hangs from, while it is open.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { available, canRecord } = menu;
  const count = menu.list.length;
  const rows = useMemo<ChromeToolsItem[]>(
    () =>
      available
        ? [
            {
              id: 'walkthroughs',
              group: 'collaborate',
              label: 'Walkthroughs',
              description: canRecord
                ? 'Record yourself talking through it.'
                : 'Play a recorded talk-through.',
              icon: <WalkthroughIcon size={16} />,
              aside:
                count > 0 ? (
                  <CountBadge tone="brand" count={count} label={`${count} walkthroughs`} />
                ) : undefined,
              onSelect: (at) => setAnchor(at),
            },
          ]
        : [],
    [available, canRecord, count],
  );
  usePublishToolsItems('walkthroughs', rows);
  if (!anchor || !available) return null;
  return (
    <PopoverOrSheet
      anchor={anchor}
      name="Walkthroughs"
      width={PANEL_WIDTH}
      onClose={() => setAnchor(null)}
    >
      {(sheet) => (
        <WalkthroughsPanel walkthroughs={menu} sheet={sheet} onClose={() => setAnchor(null)} />
      )}
    </PopoverOrSheet>
  );
}

// The panel's body: its heading, the list (or the empty state) and Record Walkthrough at its foot. Escape and a press
// outside are the popover's; the delete's confirm is a popover of its own above it, so a press in it never closes this.
export function WalkthroughsPanel({
  walkthroughs,
  sheet = false,
  onClose,
}: {
  walkthroughs: WalkthroughsMenu;
  sheet?: boolean;
  onClose: () => void;
}) {
  // Read once when the panel opens, so every row's "2 days ago" agrees and render stays pure.
  const [now] = useState(() => Date.now());
  const [confirming, setConfirming] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { list, canRecord, loading: loadingId } = walkthroughs;

  return (
    <div
      data-walkthroughs-menu=""
      className={`flex min-h-0 flex-col ${sheet ? '' : 'max-h-[min(32rem,calc(100vh-6rem))]'}`}
    >
      <div className="flex items-baseline justify-between border-b border-slate-100 px-4 pb-2.5 pt-3 dark:border-slate-800">
        <h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
          Walkthroughs
        </h2>
        {list.length > 0 ? (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {list.length} recorded
          </span>
        ) : null}
      </div>
      {list.length === 0 ? (
        <CompactEmptyState
          icon={<WalkthroughIcon size={16} />}
          title="No Walkthroughs Yet"
          description="Record yourself talking through this canvas. Anyone who can open it can play it back."
          className="py-6"
        />
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5">
          {list.map((w) => (
            <WalkthroughRow
              key={w.id}
              walkthrough={w}
              now={now}
              loading={loadingId === w.id}
              deleting={deleting === w.id}
              onPlay={() => {
                walkthroughs.play(w.id);
                onClose();
              }}
              onDelete={(at) => setConfirming({ id: w.id, anchor: at })}
            />
          ))}
        </ul>
      )}
      {canRecord ? (
        <div className="border-t border-slate-100 p-2 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              walkthroughs.record();
              onClose();
            }}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-[13px] font-medium text-white transition hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            <RecordIcon size={12} className="text-rose-300" />
            Record Walkthrough
          </button>
        </div>
      ) : null}
      {confirming ? (
        <ConfirmPopover
          anchor={confirming.anchor}
          message="Delete this walkthrough? It is deleted for everyone who can open this canvas."
          confirmLabel="Delete"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const id = confirming.id;
            setConfirming(null);
            setDeleting(id);
            void walkthroughs.remove(id).finally(() => setDeleting(null));
          }}
        />
      ) : null}
    </div>
  );
}

function WalkthroughRow({
  walkthrough: w,
  now,
  loading,
  deleting,
  onPlay,
  onDelete,
}: {
  walkthrough: WalkthroughSummary;
  now: number;
  loading: boolean;
  deleting: boolean;
  onPlay: () => void;
  onDelete: (anchor: HTMLElement) => void;
}) {
  const by = w.mine ? 'You' : (w.author ?? 'Someone');
  return (
    <li className={`group flex items-center gap-1 px-1.5 ${deleting ? 'opacity-50' : ''}`}>
      <button
        type="button"
        onClick={onPlay}
        disabled={deleting}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-slate-800"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white dark:bg-brand-500/15 dark:text-brand-200">
          {loading ? <Spinner size={14} /> : <PlayIcon size={12} className="translate-x-px" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
            {w.title}
          </span>
          <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
            <span className="tabular-nums">{formatClock(w.durationMs)}</span>
            {' · '}
            {by}
            {' · '}
            {formatRelativeTime(now - w.createdAt)}
          </span>
        </span>
      </button>
      {w.canDelete ? (
        <HoverCard title="Delete Walkthrough">
          <button
            type="button"
            aria-label={`Delete ${w.title}`}
            disabled={deleting}
            onClick={(e) => onDelete(e.currentTarget)}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-rose-500/10 dark:hover:text-rose-300 [@media(hover:none)]:opacity-100"
          >
            <TrashIcon size={13} />
          </button>
        </HoverCard>
      ) : null}
    </li>
  );
}
